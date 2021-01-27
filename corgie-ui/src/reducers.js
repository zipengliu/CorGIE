import produce from "immer";
import initialState from "./initialState";
import ACTION_TYPES, { highlightNodeType } from "./actions";
import {
    computeForceLayoutWithD3,
    computeCircularLayout,
    computeDummyLayout,
    computeForceLayoutWithCola,
    computeLocalLayoutWithCola,
    computeLocalLayoutWithD3,
    computeLocalLayoutWithUMAP,
    computeSpaceFillingCurveLayout,
} from "./layouts";
import { schemeCategory10 } from "d3-scale-chromatic";
import bs from "bitset";
import {
    histogram,
    extent,
    max,
    scaleSequential,
    interpolateGreens,
    interpolateGreys,
    scaleLinear,
} from "d3";
import {
    aggregateBinaryFeatures,
    compressFeatureValues,
    coordsRescale,
    getNeighborDistance,
    isPointInBox,
} from "./utils";

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

// Two mode: either highlight neighbors of a single node, or the neighbors of multiple nodes
function highlightNeighbors(n, neighborMasks, hops, targetNodeIdx, targetNodeArr) {
    let h = new Array(n).fill(false);
    const targetNodes = targetNodeIdx === null ? targetNodeArr : [targetNodeIdx];

    for (let i = 0; i < hops; i++) {
        // Iterate the hops
        // Flatten all hops / treating all hops the same
        for (let tar of targetNodes) {
            for (let id of neighborMasks[i][tar].toArray()) {
                h[id] = true;
            }
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

// TODO selectNodes is now an array of array fix this!!!
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

function countSelectedNeighborsByHop(neighborMasks, selectedNodes, neighArr, neighMap) {
    if (selectedNodes.length === 0) return {};

    let neighGrp = [];
    // Merge the selected nodes into an flat array
    let prevHopNodes = selectedNodes.flat();

    // iterate the masks for each hop
    let h = 0;
    for (let curHopNeigh of neighArr) {
        // Group the neighbors by frequency
        let idx = 0;
        let curGroups = [];
        while (idx < curHopNeigh.length) {
            let curG = {
                freq: neighMap[curHopNeigh[idx]].cnt,
                prevTotal: idx, // Number of neighbors previous to this group, used for computing layout
                nodes: [],
                expanded: false,
                cntsPerSelected: {}, // For roll-up matrix
                nodesPerSelected: {}, // For highlighting in the roll-up matrix
                subgroups: [],
                subGroupPrevTotal: [], // Number of neighbors previous to this subgroup (count within this group)
                isBoundary: {}, // For drawing visual boundary lines
            };
            for (let nodeId of prevHopNodes) {
                curG.cntsPerSelected[nodeId] = 0;
                curG.nodesPerSelected[nodeId] = [];
            }

            let j = idx;
            while (j < curHopNeigh.length) {
                let curNeighData = neighMap[curHopNeigh[j]];
                if (curNeighData.cnt !== curG.freq) break;
                curG.nodes.push(curHopNeigh[j]);

                // Compute the counts per prev-hop node
                for (let nodeId of prevHopNodes) {
                    const m = neighborMasks[0][nodeId];
                    if (m.get(curHopNeigh[j])) {
                        curG.cntsPerSelected[nodeId]++;
                        curG.nodesPerSelected[nodeId].push(curHopNeigh[j]);
                    }
                }

                // Compute the subgroups by comparing neighbor j with j-1
                if (j === idx || !curNeighData.mask.equals(neighMap[curHopNeigh[j - 1]].mask)) {
                    // add a new subgroup
                    curG.subgroups.push([curHopNeigh[j]]);
                    curG.subGroupPrevTotal.push(j - idx); // count within this group
                    curG.isBoundary[curHopNeigh[j]] = true;
                } else {
                    curG.subgroups[curG.subgroups.length - 1].push(curHopNeigh[j]);
                }

                j++;
            }
            curGroups.push(curG);
            idx = j;
        }

        neighGrp.push(curGroups);
        prevHopNodes = curHopNeigh;
        h++;
    }

    console.log({ neighGrp });
    // Note that cnts does not have info about hop
    return neighGrp;
}

function computeDistanceToCurrentFocus(distMatrix, focalNodes) {
    if (focalNodes.length === 0) {
        return null;
    }
    const d = [];
    for (let i = 0; i < distMatrix.length; i++) {
        let t = 0;
        for (let nodeId of focalNodes) {
            t += distMatrix[i][nodeId];
        }
        d.push(t / focalNodes.length);
    }
    console.log({ extent: extent(d) });
    return d;
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
    } else if (state.param.graph.layout === "circular") {
        layoutRes = computeCircularLayout(graph.nodes, copiedEdges, state.spec.graph, state.centralNodeType);
    } else {
        layoutRes = computeDummyLayout(graph.nodes);
    }
    state.spec.graph.width = layoutRes.width;
    state.spec.graph.height = layoutRes.height;

    return layoutRes.coords;
}

// Note that attrs will be changed by calling this function
// attrMeta is an array of object that describes the attribute names and types
// attrs is the histogram data for all nodes (for computing sub-distribution of selected nodes)
function summarizeNodeAttrs(nodes, attrMeta, nodeTypes, attrs = null, included = null) {
    let res = attrMeta.map((a) => ({ ...a }));
    // Init
    for (let a of res) {
        if (a.type === "scalar") {
            a.values = []; // The attribute values, used for compuing stats
        } else if (a.type === "categorical") {
            a.values = {}; // A mapping from value to count
        }
    }

    // Count
    function countValues(n) {
        for (let a of res) {
            if (nodeTypes[n.typeId].name === a.nodeType) {
                if (a.type === "scalar") {
                    n[a.name] = +n[a.name];
                    a.values.push(n[a.name]);
                } else if (a.type === "categorical") {
                    if (!a.values.hasOwnProperty(n[a.name])) {
                        a.values[n[a.name]] = 0;
                    }
                    a.values[n[a.name]]++;
                }
            }
        }
    }

    if (included !== null) {
        for (let nid of included) {
            countValues(nodes[nid]);
        }
    } else {
        for (let n of nodes) {
            countValues(n);
        }
    }
    // Binning
    const thresCnt = 10;
    for (let i = 0; i < res.length; i++) {
        let a = res[i];
        if (a.type === "scalar") {
            if (attrs) {
                a.bins = attrs[i].binGen(a.values);
            } else {
                let s = scaleLinear().domain(extent(a.values)).nice(thresCnt);
                a.binGen = histogram().domain(s.domain()).thresholds(s.ticks(thresCnt));
                a.bins = a.binGen(a.values);
            }
        } else {
            if (attrs) {
                a.bins = attrs[i].bins.map((b) => ({ v: b.v, c: a.values[b.v] }));
            } else {
                a.bins = Object.keys(a.values)
                    .sort((x, y) => a.values[x] - a.values[y])
                    .map((x) => ({ v: x, c: a.values[x] }));
            }
        }
    }
    return res;
}

function computeBoundingBox(coords, included) {
    let xMin = 1e9,
        xMax = 0,
        yMin = 1e9,
        yMax = 0;
    const padding = 5;
    for (let nid of included) {
        const c = coords[nid];
        xMin = Math.min(xMin, c.x);
        xMax = Math.max(xMax, c.x);
        yMin = Math.min(yMin, c.y);
        yMax = Math.max(yMax, c.y);
    }
    return {
        x: xMin - padding,
        y: yMin - padding,
        width: xMax - xMin + 2 * padding,
        height: yMax - yMin + 2 * padding,
    };
}

// Compute the distance between node pairs by comparing their neighbor sets
function computeEdgeLengthTopo(edges, masks, distMetric) {
    for (let e of edges) {
        const m1 = masks[e.source],
            m2 = masks[e.target];
        e.dNei = getNeighborDistance(m1, m2, distMetric);
    }
    return;
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
            const { graph, emb, emb2d, attrs, features } = action.data;
            // the scalar values in emb are in string format, so convert them to float first
            for (let e of emb) {
                for (let i = 0; i < e.length; i++) {
                    e[i] = parseFloat(e[i]);
                }
            }
            draft.datasetId = action.data.datasetId;
            draft.graph = {
                nodes: graph.nodes,
                edges: graph.links.map((e, i) => ({ ...e, eid: i })),
                nodeTypes: countNodesByType(graph.nodes),
                features,
            };
            draft.featureVis = {
                values: null,
            };
            if (features && features[0][0] % 1 == 0) {
                // is binary features
                draft.featureVis.values = aggregateBinaryFeatures(features, null);
                draft.featureVis.maxVal = max(draft.featureVis.values);
                draft.featureVis.compValues = compressFeatureValues(
                    draft.featureVis.values,
                    draft.spec.feature.barcodeMaxWidth
                );
                draft.featureVis.scale = scaleSequential(interpolateGreys).domain([
                    0,
                    draft.featureVis.maxVal,
                ]);
            }
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
            computeEdgeLengthTopo(
                draft.graph.edges,
                draft.graph.neighborMasks,
                draft.param.neighborDistanceMetric
            );

            draft.latent = {
                emb,
                coords: coordsRescale(emb2d, draft.spec.latent.width, draft.spec.latent.height),
                binGen: histogram().domain([0, 1]).thresholds(40),
                isComputing: true,
            };

            draft.attrMeta = attrs;
            draft.nodeAttrs = summarizeNodeAttrs(graph.nodes, attrs, draft.graph.nodeTypes);

            draft.isNodeSelected = new Array(graph.nodes.length).fill(false);
            return;

        case ACTION_TYPES.COMPUTE_DISTANCES_DONE:
            Object.assign(draft.latent, action.distData);
            // Populate the edge length data to the graph.edges
            for (let i = 0; i < draft.graph.edges.length; i++) {
                draft.graph.edges[i].d = action.distData.edgeLen[i];
            }
            draft.showEdges = draft.graph.edges
                .filter(
                    (e) =>
                        draft.param.filter.edgeDistRange[0] <= e.d &&
                        e.d <= draft.param.filter.edgeDistRange[1]
                )
                .sort((e1, e2) => e1.d - e2.d);
            // Compute the histogram bins
            draft.latent.edgeLenBins = draft.latent.binGen(draft.latent.edgeLen);
            draft.latent.allDistBins = draft.latent.binGen(draft.latent.distArray.map((x) => x.d));

            draft.latent.isComputing = false;

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
            if (action.brushedArea !== null && action.fromView !== null) {
                draft.nodesToHighlight = action.nodeIndices;
                draft.isNodeHighlighted = {};
                for (let nid of action.nodeIndices) {
                    draft.isNodeHighlighted[nid] = true;
                }
                draft.highlightTrigger = { by: action.fromView, which: action.whichAttr, brushedArea: action.brushedArea };
                // Highlight the neighbors as well
                // const neighToHighlight = highlightNeighbors(
                //     draft.graph.nodes.length,
                //     draft.graph.neigh,
                //     draft.param.hopsHighlight,
                //     null,
                //     draft.nodesToHighlight
                // );
                // // Merge into draft.isNodeHighlighted
                // for (let neighId in neighToHighlight)
                //     if (neighToHighlight[neighId]) {
                //         draft.isNodeHighlighted[neighId] = true;
                //     }
            } else {
                if (action.nodeIdx === null) {
                    draft.highlightTrigger = null;
                    draft.isNodeHighlighted = {};
                    draft.edgesToHighlight = [];
                    draft.nodesToHighlight = [];
                } else {
                    draft.highlightTrigger = { by: "node", which: action.nodeIdx };
                    draft.isNodeHighlighted = highlightNeighbors(
                        draft.graph.nodes.length,
                        draft.graph.neigh,
                        draft.param.hopsHighlight,
                        action.nodeIdx,
                        null
                    );
                    draft.isNodeHighlighted[action.nodeIdx] = true;
                    draft.nodesToHighlight = [action.nodeIdx];
                }
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
        case ACTION_TYPES.SELECT_NODES_PENDING:
            let { newSel, neighRes } = action;
            draft.selectedNodes = newSel;
            if (newSel.length == 0) {
                // Clear selection
                draft.neighArr = null;
                draft.neighMap = null;
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.neighGrp = null;
                draft.selNodeAttrs = [];
                draft.focalGraphLayout = { running: false };
                draft.selBoundingBox = [];
            } else {
                draft.isNodeSelected = neighRes.isNodeSelected;
                draft.isNodeSelectedNeighbor = neighRes.isNodeSelectedNeighbor;
                draft.neighMap = neighRes.neighMap;
                draft.neighArr = neighRes.neighArr;
                // neighGrp is for the roll-up matrix of neighbor counts
                draft.neighGrp = countSelectedNeighborsByHop(
                    draft.graph.neigh,
                    draft.selectedNodes,
                    neighRes.neighArr,
                    neighRes.neighMap
                );

                draft.selNodeAttrs = newSel.map((sel) =>
                    summarizeNodeAttrs(
                        draft.graph.nodes,
                        draft.attrMeta,
                        draft.graph.nodeTypes,
                        draft.nodeAttrs,
                        sel
                    )
                );
                draft.focalGraphLayout.running = true;
                draft.selBoundingBox = newSel.map((s) => computeBoundingBox(draft.latent.coords, s));
            }

            // Clear the highlight (blinking) nodes
            // draft.nodesToHighlight = [];
            // draft.isNodeHighlighted = {};

            // draft.latent.distToCurFoc = computeDistanceToCurrentFocus(
            //     draft.latent.distMatrix,
            //     draft.selectedNodes
            // );

            return;
        case ACTION_TYPES.SELECT_NODES_DONE:
            draft.focalGraphLayout = { ...action.layoutRes, running: false };
            return;
        case ACTION_TYPES.SELECT_EDGE:
            // Clear the highlight nodes
            draft.nodesToHighlight = [];
            draft.isNodeHighlighted = {};

            if (draft.selectedEdge !== action.eid) {
                draft.selectedEdge = action.eid;
                if (action.eid !== null) {
                    draft.selectedNodes = [
                        [draft.graph.edges[action.eid].source],
                        [draft.graph.edges[action.eid].target],
                    ];
                    draft.isNodeSelected = {};
                    draft.isNodeSelected[draft.selectedNodes[0]] = true;
                    draft.isNodeSelected[draft.selectedNodes[1]] = true;

                    // TODO dup code
                    draft.isNodeSelectedNeighbor = {};
                    for (let nodeIdx in draft.isNodeSelected)
                        if (draft.isNodeSelected[nodeIdx]) {
                            for (let h = draft.param.hops - 1; h >= 0; h--) {
                                const curNeigh = draft.graph.neigh[h][nodeIdx];
                                for (let neighIdx of curNeigh.toArray()) {
                                    if (neighIdx !== nodeIdx) {
                                        if (draft.isNodeSelectedNeighbor.hasOwnProperty(neighIdx)) {
                                            draft.isNodeSelectedNeighbor[neighIdx] = Math.min(
                                                draft.isNodeSelectedNeighbor[neighIdx],
                                                h + 1
                                            );
                                        } else {
                                            draft.isNodeSelectedNeighbor[neighIdx] = h + 1;
                                        }
                                    }
                                }
                            }
                        }

                    const temp = countSelectedNeighborsByHop(
                        draft.graph.neigh,
                        draft.selectedNodes,
                        draft.param.hops,
                        draft.isNodeSelected,
                        draft.isNodeSelectedNeighbor
                    );
                    draft.neighGrp = temp.neighGrp;
                    draft.neighMap = temp.neighMap;
                    draft.neighArr = temp.neighArr;

                    // draft.focalGraphLayout = callLocalLayoutFunc(draft);
                    // Update the bounding box for the highlight group TODO
                    // for (let h of draft.highlightNodeAttrs) {
                    //     h.boundingBox = computeBoundingBox(draft.focalGraphLayout.coords, h.nodes);
                    // }
                }
            }
            return;
        case ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE:
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

            // Special param changes
            if (action.param === "graph.layout") {
                draft.graph.coords = callLayoutFunc(draft);
            } else if (action.param === "focalGraph.layout") {
                // TODO
                // draft.focalGraphLayout = callLocalLayoutFunc(draft);
            } else if (action.param === "colorBy") {
                if (action.value === "position") {
                    draft.param.colorScale = null;
                } else {
                    const colorAttr = draft.nodeAttrs[action.value];
                    const attrDomain = [colorAttr.bins[0].x0, colorAttr.bins[colorAttr.bins.length - 1].x1];
                    const leftMargin = 0.2 * (attrDomain[1] - attrDomain[0]);
                    draft.param.colorScale = scaleSequential(interpolateGreens).domain([
                        attrDomain[0] - leftMargin,
                        attrDomain[1],
                    ]);
                }
            } else if (action.param === "filter.edgeDistRange") {
                draft.showEdges = draft.graph.edges
                    .filter(
                        (e, i) =>
                            action.value[0] <= draft.latent.edgeLen[i] &&
                            draft.latent.edgeLen[i] <= action.value[1]
                    )
                    .sort((e1, e2) => e1.d - e2.d);
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
                    if (converged || draft.focalGraphLayout.simulationTickNumber > 20) {
                        // if (converged) {
                        draft.focalGraphLayout.running = false;
                    }
                } else {
                    if (draft.focalGraphLayout.simulationTickNumber === 50) {
                        draft.focalGraphLayout.running = false;
                    }
                }
                draft.focalGraphLayout.simulationTickNumber += 1;
            }
            return;

        case ACTION_TYPES.CHANGE_EDGE_TYPE_STATE:
            draft.edgeAttributes.type.show[action.idx] = !draft.edgeAttributes.type.show[action.idx];
            return;

        default:
            return;
    }
}, initialState);

export default reducers;
