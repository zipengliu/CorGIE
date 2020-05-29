import produce from "immer";
import initialState from "./initialState";
import ACTION_TYPES from "./actions";
import {
    computeForceLayoutWithD3,
    coordsRescale,
    computeCircularLayout,
    getAllNodeDistance,
    computeForceLayoutWithCola,
    computeLocalLayoutWithCola,
    computeLocalLayoutWithD3,
} from "./layouts";
import { schemeCategory10 } from "d3-scale-chromatic";
import bs from "bitset";
import { histogram, select } from "d3";

function mapColorToNodeType(nodeTypes) {
    for (let i = 0; i < nodeTypes.length; i++) {
        if (i > schemeCategory10.length - 1) {
            nodeTypes[i].color = "black";
        } else {
            nodeTypes[i].color = schemeCategory10[i];
        }
    }
}

// count all, only happen in the initialization phase
function countNodesByType(nodes) {
    let counts = {};
    for (let n of nodes) {
        if (!counts.hasOwnProperty(n.type)) {
            counts[n.type] = 0;
        }
        counts[n.type]++;
    }
    return Object.keys(counts).map((t, i) => ({ id: i, name: t, count: counts[t] }));
}

function countNeighborsByType(neighborMasksByType, selectedNodes) {
    // Not including itself
    let nei = [];
    for (let i = 0; i < neighborMasksByType[0].length; i++) {
        nei.push(bs(0));
    }
    for (let i of selectedNodes) {
        for (let j = 0; j < neighborMasksByType[i].length; j++) {
            nei[j] = nei[j].or(neighborMasksByType[i][j]);
        }
    }
    return nei.map((n) => n.cardinality());
}

// Assign a node type index to each node and return a mapping from type (string) to typeIndex (int)
// Note: this function changes the nodes
function populateNodeTypeIndex(nodes, nodeTypes) {
    let mapping = {},
        a = [],
        i = 0;
    for (let nt of nodeTypes) {
        mapping[nt.name] = nt.id;
    }
    for (let n of nodes) {
        n.typeId = mapping[n.type];
    }
}

function getNeighborMasks(nodes, edges, numberOfNodeTypes) {
    // Init the masks for each node: an array of array of zero masks
    let masks = nodes.map(() => {
        let m = [];
        for (let i = 0; i < numberOfNodeTypes; i++) {
            m.push(bs(0));
        }
        return m;
    });

    for (let e of edges) {
        const sid = e.source,
            tid = e.target;
        const srcType = nodes[sid].typeId,
            tgtType = nodes[tid].typeId;
        masks[sid][tgtType].set(tid, 1);
        masks[tid][srcType].set(sid, 1);
    }
    return masks;
}

function getNeighborMasksByHops(nodes, edges, hops) {
    let masksByHops = [],
        last;
    for (let h = 0; h < hops; h++) {
        let cur = nodes.map(() => bs(0));
        for (let e of edges) {
            const sid = e.source,
                tid = e.target;
            if (h === 0) {
                cur[sid].set(tid, 1);
                cur[tid].set(sid, 1);
            } else {
                for (let i = 0; i < last.length; i++) {
                    const m = last[i];
                    if (m.get(sid) === 1) {
                        cur[i].set(tid, 1);
                    }
                    if (m.get(tid) === 1) {
                        cur[i].set(sid, 1);
                    }
                }
            }
        }
        masksByHops.push(cur);
        last = cur;
        // console.log({ h });
        // console.log(cur.map((m) => m.toArray()));
    }
    return masksByHops;
}

function highlightNeighbors(n, neighborMasks, hops, targetNodeIdx) {
    let h = new Array(n).fill(false);
    // for (let e of edges) {
    //     if (e.source.index === targetNodeIdx) {
    //         h[e.target.index] = true;
    //     } else if (e.target.index === targetNodeIdx) {
    //         h[e.source.index] = true;
    //     }
    // }
    // for (let id of neighborMasks[targetNodeIdx].toArray()) {
    //     h[id] = true;
    // }

    for (let i = 0; i < hops; i++) {
        // Iterate the hops
        // Flatten all hops / treating all hops the same
        for (let id of neighborMasks[i][targetNodeIdx].toArray()) {
            h[id] = true;
        }
    }
    return h;
}

// Return an array of all combinations of intersection, represented as bitsets of the selectedNodes
// Total number of combo is 2^n - 1 - n, where n is the number of selected nodes
// O(2^n)
function generateIntersectionCombo(n) {
    let combos = [];
    for (let i = 1; i <= n; i++) {
        // Iterate over the number of sets to intersect
        let cur = bs(0);
        function search(start, ones) {
            if (ones === 0) {
                // save this bs
                combos.push(cur.clone());
                return;
            }
            for (let j = start; j <= n - ones; j++) {
                cur.set(j, 1);
                search(j + 1, ones - 1);
                cur.set(j, 0);
            }
        }
        search(0, i);
    }
    // console.log(combos.map(c => c.toString()));
    return combos;
}

function computeIntersections(neighborMasksByType, selectedNodes) {
    if (selectedNodes.length < 2) {
        return null;
    }
    const combos = generateIntersectionCombo(selectedNodes.length);
    let intersections = [];
    // This is potentially slow due to spatial locality
    // And the combo bitset is duped
    for (let i = 0; i < neighborMasksByType[0].length; i++) {
        intersections.push(
            combos.map((c) => {
                const bits = c.toArray();
                let r = bs(0).flip();
                for (let b of bits) {
                    const nodeIdx = selectedNodes[b];
                    r = r.and(neighborMasksByType[nodeIdx][i]);
                }
                return { combo: c, res: r, size: r.cardinality() };
            })
        );
    }
    return intersections;
}

// Count frequency of a neighbor presenting in the neighbor sets of the selected nodes
// Return an array, each item in the array is an object with the node id and frequencies, sorted by node types.
// Quadratic time to the number of nodes.  Potentially we can apply incremental changes and reduce computation
// TODO: use frequency as second sort key?
// Also compute the bins of histogram
// Note: return one histogram for each neighbor node type.  The input is already sorted
function countNeighborSets(neighborMasksByType, selectedNodes) {
    if (selectedNodes.length === 0) return { allCounts: [], bins: [], countsByType: [] };

    // Init
    let cnts = [],
        histos = [];
    for (let i = 0; i < neighborMasksByType[0].length; i++) {
        cnts.push({});
    }

    // Count
    for (let nid of selectedNodes) {
        for (let i = 0; i < neighborMasksByType[0].length; i++) {
            const nei = neighborMasksByType[nid][i].toArray();
            for (let b of nei) {
                if (!cnts[i].hasOwnProperty(b)) {
                    cnts[i][b] = 0;
                }
                cnts[i][b]++;
            }
        }
    }

    // TODO:  use a smarter thresholds later
    // const thresholds = [];
    // for (let i = 1; i < selectedNodes.length + 1; i++) {
    //    thresholds.push(i - 0.01);
    // }
    // console.log(thresholds);
    const binGen = histogram().thresholds(selectedNodes.length);

    // Flatten the cnts array
    let allCounts = [],
        allCountsMapping = {},
        countsByType = [];
    for (let c of cnts) {
        const idx = Object.keys(c);
        const temp = [];
        for (let i of idx) {
            temp.push({ id: i, cnt: c[i] });
            allCountsMapping[i] = c[i];
        }
        // Sort
        temp.sort((a, b) => b.cnt - a.cnt);
        allCounts = allCounts.concat(temp);
        countsByType.push(temp);
        // Compute bins of counts
        histos.push(binGen(temp.map((t) => t.cnt)));
    }
    return { allCounts, allCountsMapping, bins: histos, countsByType };
}

function countSelectedNeighborsByHop(neighborMasks, selectedNodes) {
    if (selectedNodes.length === 0) return {};

    // compute a mask for the selected nodes
    let selMask = bs(0);
    for (let selectedId of selectedNodes) {
        selMask.set(selectedId, 1);
    }
    console.log("counting...");
    console.log(selectedNodes, selMask);

    let res = [],
        cnts, cntArray;
    for (let curMasks of neighborMasks) {
        // iterate the masks for each hop
        let curGroups = [];

        // Find out the frequency of each neighbor in that hop
        cnts = {};
        for (let selectedId of selectedNodes) {
            const m = curMasks[selectedId].toArray();
            for (let neighId of m) {
                if (!cnts.hasOwnProperty(neighId)) {
                    cnts[neighId] = { cnt: 0, mask: curMasks[neighId].and(selMask) };
                }
                cnts[neighId].cnt++;
            }
        }

        // Group the neighbors by frequency
        // 1. convert mapping to array
        cntArray = [];
        for (let neighId in cnts)
            if (cnts.hasOwnProperty(neighId)) {
                cntArray.push({ id: parseInt(neighId), cnt: cnts[neighId].cnt, mask: cnts[neighId].mask });
            }
        // 2. sort array by freq
        cntArray.sort((a, b) => b.cnt - a.cnt);
        for (let i = 0; i < cntArray.length; i++) {
            cnts[cntArray[i].id].order = i;
        }
        // 3. group
        let idx = 0;
        while (idx < cntArray.length) {
            let curG = {
                freq: cntArray[idx].cnt,
                prevTotal: idx, // Number of neighbors previous to this group, used for computing layout
                nodes: [],
                expanded: false,
                cntsPerSelected: {},        // For roll-up matrix
                nodesPerSelected: {},       // For highlighting in the roll-up matrix
                subgroups: [],
                subGroupPrevTotal: [],      // Number of neighbors previous to this subgroup (count within this group)
                isBoundary: {},     // For drawing visual boundary lines
            };
            for (let selectedId of selectedNodes) {
                curG.cntsPerSelected[selectedId] = 0;
                curG.nodesPerSelected[selectedId] = [];
            }

            let j = idx;
            while (j < cntArray.length && cntArray[j].cnt === curG.freq) {
                curG.nodes.push(cntArray[j].id);

                // Compute the counts per selected node
                for (let selectedId of selectedNodes) {
                    const m = curMasks[selectedId];
                    if (m.get(cntArray[j].id)) {
                        curG.cntsPerSelected[selectedId]++;
                        curG.nodesPerSelected[selectedId].push(cntArray[j].id);
                    }
                }

                // Compute the subgroups by comparing neighbor j with j-1
                if (j === idx || !cntArray[j].mask.equals(cntArray[j - 1].mask)) {
                    // add a new subgroup
                    curG.subgroups.push([cntArray[j].id]);
                    curG.subGroupPrevTotal.push(j - idx);        // count within this group
                    curG.isBoundary[cntArray[j].id] = true;
                } else {
                    curG.subgroups[curG.subgroups.length - 1].push(cntArray[j].id);
                }

                j++;
            }
            curGroups.push(curG);
            idx = j;
        }

        res.push(curGroups);
        break; // TODO only work for the 1-hop now
    }

    // Note that cnts does not have info about hop
    return { neighGrp: res, neighMap: cnts, neighArr: [cntArray.map(x => x.id)] };
}

function isPointInBox(p, box) {
    const offX = p.x - box.x,
        offY = p.y - box.y;
    return 0 <= offX && offX <= box.width && 0 <= offY && offY <= box.height;
}

function callLayoutFunc(state) {
    const { graph } = state;
    const copiedEdges = graph.edges.map((e) => ({ ...e }));
    let layoutRes;
    if (state.param.graph.layout === "force-directed-d3") {
        // Make a copy of the edges to prevent them from changes by the force simulation
        layoutRes = computeForceLayoutWithD3(graph.nodes, copiedEdges);
    } else if (state.param.graph.layout === "force-directed-cola") {
        layoutRes = computeForceLayoutWithCola(graph.nodes, copiedEdges, state.spec.graph);
    } else {
        layoutRes = computeCircularLayout(graph.nodes, copiedEdges, state.spec.graph, state.centralNodeType);
    }
    state.spec.graph.width = layoutRes.width;
    state.spec.graph.height = layoutRes.height;

    return layoutRes.coords;
}

function callLocalLayoutFunc(state) {
    // Compute the force layout for focal nodes (selected + k-hop neighbors)
    if (state.selectedNodes.length === 0) {
        return {};
    } else {
        if (state.param.focalGraph.layout === "group-constraint-cola") {
            return computeLocalLayoutWithCola(
                state.graph.nodes,
                state.graph.edges,
                state.param.hops,
                state.isNodeSelected,
                state.isNodeSelectedNeighbor,
                state.neighGrp,
                state.spec.graph
            );
        } else {
            return computeLocalLayoutWithD3(
                state.graph.nodes,
                state.graph.edges,
                state.param.hops,
                state.isNodeSelected,
                state.isNodeSelectedNeighbor,
                state.neighMap,
                state.spec.graph
            );
        }
    }
}

const reducers = produce((draft, action) => {
    switch (action.type) {
        case ACTION_TYPES.FETCH_DATA_PENDING:
            draft.loaded = false;
            return;
        case ACTION_TYPES.FETCH_DATA_ERROR:
            draft.loaded = false;
            draft.error = action.error;
            return;
        case ACTION_TYPES.FETCH_DATA_SUCCESS:
            draft.loaded = true;
            const { graph, emb, emb2d } = action.data;
            draft.datasetId = action.data.datasetId;
            draft.graph = {
                nodes: graph.nodes,
                edges: graph.links,
                nodeTypes: countNodesByType(graph.nodes),
            };
            draft.focalGraphLayout = {};
            populateNodeTypeIndex(graph.nodes, draft.graph.nodeTypes);
            mapColorToNodeType(draft.graph.nodeTypes);
            draft.graph.coords = callLayoutFunc(draft);
            draft.graph.neigh = getNeighborMasksByHops(graph.nodes, graph.links, draft.param.hops);
            draft.graph.neighborMasksByType = getNeighborMasks(
                graph.nodes,
                graph.links,
                draft.graph.nodeTypes.length,
                draft.param.hops
            );
            draft.graph.neighborMasks = draft.graph.neighborMasksByType.map((m) =>
                m.reduce((acc, x) => acc.or(x), bs(0))
            );

            draft.latent = {
                emb,
                coords: coordsRescale(emb2d, draft.spec.latent.width, draft.spec.latent.height),
                nodeDist: getAllNodeDistance(emb, draft.graph.edges),
            };
            let binGen = histogram()
                .domain([0, 1])
                .value((d) => d.d)
                .thresholds(50);
            draft.latent.distBinPresent = binGen(draft.latent.nodeDist.filter((d) => d.p));
            draft.latent.distBinAbsent = binGen(draft.latent.nodeDist.filter((d) => !d.p));
            // draft.latent.coords = runTSNE(draft.latent.distMat, draft.spec.latent);

            draft.isNodeSelected = new Array(graph.nodes.length).fill(false);
            return;

        case ACTION_TYPES.HIGHLIGHT_NODE_TYPE:
            if (action.nodeTypeIdx === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = {};
            } else {
                draft.highlightTrigger = { by: "type", which: action.nodeTypeIdx };
                draft.isNodeHighlighted = draft.graph.nodes.map((n) => n.typeId === action.nodeTypeIdx);
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NODES:
            draft.showDetailNode = action.nodeIdx;
            if (action.nodeIdx === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = {};
            } else {
                draft.highlightTrigger = { by: "node", which: action.nodeIdx };
                draft.isNodeHighlighted = highlightNeighbors(
                    draft.graph.nodes.length,
                    draft.graph.neigh,
                    draft.param.hopsHighlight,
                    action.nodeIdx
                );
                draft.isNodeHighlighted[action.nodeIdx] = true;
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NEIGHBORS:
            draft.isNodeHighlighted = {};
            if (action.nodes) {
                for (let i of action.nodes) {
                    draft.isNodeHighlighted[i] = true;
                }
            }
            return;
        case ACTION_TYPES.SELECT_NODES:
            if (action.selectionBox != null) {
                if (!action.appendMode) {
                    draft.selectedNodes = [];
                    draft.isNodeSelected = {};
                }
                for (let i = 0; i < draft.latent.coords.length; i++) {
                    const c = draft.latent.coords[i];
                    if (
                        draft.graph.nodes[i].typeId === draft.selectedNodeType &&
                        isPointInBox(c, action.selectionBox)
                    ) {
                        draft.selectedNodes.push(i);
                        draft.isNodeSelected[i] = true;
                    }
                }
            } else {
                if (draft.graph.nodes[action.nodeIdx].typeId !== draft.selectedNodeType) {
                    // If user wants to select a node that is not the selected node type, do nothing
                    return;
                }
                if (draft.isNodeSelected[action.nodeIdx]) {
                    // Deletion
                    const p = draft.selectedNodes.indexOf(action.nodeIdx);
                    draft.selectedNodes.splice(p, 1);
                    draft.isNodeSelected[action.nodeIdx] = false;
                } else {
                    // Addition
                    draft.selectedNodes.push(action.nodeIdx);
                    draft.isNodeSelected[action.nodeIdx] = true;
                }
            }
            draft.selectedCountsByType = countNeighborsByType(
                draft.graph.neighborMasksByType,
                draft.selectedNodes
            );
            if (draft.selectedNodes.length <= draft.powerSetLimit) {
                draft.neighborIntersections = computeIntersections(
                    draft.graph.neighborMasksByType,
                    draft.selectedNodes
                );
            }

            // Deprecated
            // const temp = countNeighborSets(draft.graph.neighborMasksByType, draft.selectedNodes);
            // draft.neighborCounts = temp.allCounts;
            // draft.neighborCountsMapping = temp.allCountsMapping;
            // draft.neighborCountsByType = temp.countsByType;
            // draft.neighborCountsBins = temp.bins;

            const temp = countSelectedNeighborsByHop(draft.graph.neigh, draft.selectedNodes);
            draft.neighGrp = temp.neighGrp;
            draft.neighMap = temp.neighMap;
            draft.neighArr = temp.neighArr;

            // Compute whether a node is the neighbor of selected nodes, if yes, specify the #hops
            // The closest / smallest hop wins if it is neighbor of multiple selected nodes
            draft.isNodeSelectedNeighbor = {};
            for (let nodeIdx of draft.selectedNodes) {
                for (let h = draft.param.hops - 1; h >= 0; h--) {
                    const curNeigh = draft.graph.neigh[h][nodeIdx];
                    for (let neighIdx of curNeigh.toArray()) {
                        if (neighIdx !== nodeIdx) {
                            draft.isNodeSelectedNeighbor[neighIdx] = h + 1;
                        }
                    }
                }
            }
            draft.focalGraphLayout = callLocalLayoutFunc(draft);
            return;
        case ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE:
            if (
                draft.selectedNodes.length > 0 &&
                draft.graph.nodes[draft.selectedNodes[0]].typeId !== action.idx
            ) {
                // Remove the current selection
                draft.selectedNodes = [];
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.focalGraphLayout = {};
            }
            draft.selectedNodeType = action.idx;
            return;
        case ACTION_TYPES.CHANGE_PARAM:
            const paramPath = action.param.split(".");
            const lastParam = paramPath[paramPath.length - 1];
            let cur = draft.param;
            for (let i = 0; i < paramPath.length - 1; i++) {
                cur = cur[paramPath[i]];
            }
            if (action.inverse) {
                cur[lastParam] = !cur[lastParam];
            } else {
                cur[lastParam] = action.value;
            }

            if (action.param === "graph.layout") {
                draft.graph.coords = callLayoutFunc(draft);
            } else if (action.param === "focalGraph.layout") {
                draft.focalGraphLayout = callLocalLayoutFunc(draft);
            }
            return;
        case ACTION_TYPES.CHANGE_HOPS:
            if (draft.param.hops !== action.hops) {
                draft.param.hops = action.hops;
                // Re-calculate the neighbor masks
                draft.graph.neigh = getNeighborMasksByHops(
                    draft.graph.nodes,
                    draft.graph.edges,
                    draft.param.hops
                );
                // draft.graph.neighborMasksByType = getNeighborMasks(
                //     draft.graph.nodes,
                //     draft.graph.edges,
                //     draft.graph.nodeTypes.length,
                //     action.hops
                // );
                // draft.graph.neighborMasks = draft.graph.neighborMasksByType.map(m =>
                //     m.reduce((acc, x) => acc.or(x), bs(0))
                // );

                // Clear the selection
                draft.selectedNodes = [];
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.focalGraphLayout = {};
            }
            return;
        case ACTION_TYPES.LAYOUT_TICK:
            // Note that in D3, the tick function returns the simulation object itself
            // In web-cola, the tick function returns whether the simulation has converged
            if (draft.focalGraphLayout && draft.focalGraphLayout.simulation) {
                const converged = draft.focalGraphLayout.simulation.tick();
                draft.focalGraphLayout.coords = draft.focalGraphLayout.simulation.nodes().map((d) => ({
                    x: d.x,
                    y: d.y,
                    g: d.group,
                }));
                if (draft.param.focalGraph.layout === "group-constraint-cola") {
                    // This is only a dirty way for quick check
                    draft.focalGraphLayout.groups = draft.focalGraphLayout.simulation._groups.map((g) => ({
                        id: g.id,
                        bounds: g.bounds,
                    }));
                    // if (converged || draft.focalGraphLayout.simulationTickNumber > 20) {
                    if (converged) {
                        draft.focalGraphLayout.running = false;
                    }
                } else {
                    if (draft.focalGraphLayout.simulationTickNumber === 300) {
                        draft.focalGraphLayout.running = false;
                    }
                }
                draft.focalGraphLayout.simulationTickNumber += 1;
            }
            return;

        default:
            return;
    }
}, initialState);

export default reducers;
