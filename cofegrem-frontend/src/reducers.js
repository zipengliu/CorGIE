import produce from 'immer';
import initialState from "./initialState";
import ACTION_TYPES from './actions';
import {computeForceLayout, coordsRescale, computeCircularLayout, getAllNodeDistance} from './layouts';
import {schemeCategory10} from 'd3-scale-chromatic';
import bs from 'bitset';
import {histogram} from 'd3';


function mapColorToNodeType(nodeTypes) {
    for (let i = 0; i < nodeTypes.length; i++) {
        if (i > schemeCategory10.length - 1) {
            nodeTypes[i].color = 'black';
        } else {
            nodeTypes[i].color = schemeCategory10[i];
        }
    }
}

// count all, only happen in the initialization phase
function countNodesByType(nodes) {
    let counts = {}; for (let n of nodes) {
        if (!counts.hasOwnProperty(n.type)) {
            counts[n.type] = 0;
        }
        counts[n.type]++;
    }
    return Object.keys(counts).map((t, i) => ({id: i, name: t, count: counts[t]}));
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
    return nei.map(n => n.cardinality());
}

// Assign a node type index to each node and return a mapping from type (string) to typeIndex (int)
// Note: this function changes the nodes
function populateNodeTypeIndex(nodes, nodeTypes) {
    let mapping = {}, a = [], i = 0;
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
        const sid = e.source.index, tid = e.target.index;
        const srcType = nodes[sid].typeId, tgtType = nodes[tid].typeId;
        masks[sid][tgtType].set(tid, 1);
        masks[tid][srcType].set(sid, 1);
    }
    return masks;
}

function highlightNeighbors(n, neighborMasks, targetNodeIdx) {
    let h = (new Array(n)).fill(false);
    // for (let e of edges) {
    //     if (e.source.index === targetNodeIdx) {
    //         h[e.target.index] = true;
    //     } else if (e.target.index === targetNodeIdx) {
    //         h[e.source.index] = true;
    //     }
    // }
    for (let id of neighborMasks[targetNodeIdx].toArray()) {
        h[id] = true;
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
        intersections.push(combos.map(c => {
            const bits = c.toArray();
            let r = bs(0).flip();
            for (let b of bits) {
                const nodeIdx = selectedNodes[b];
                r = r.and(neighborMasksByType[nodeIdx][i]);
            }
            return {combo: c, res: r, size: r.cardinality()};
        }));
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
    if (selectedNodes.length === 0)
        return {allCounts: [], bins: [], countsByType: []};

    // Init
    let cnts = [], histos = [];
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
    let allCounts = [], countsByType = [];
    for (let c of cnts) {
        const idx = Object.keys(c);
        const temp = [];
        for (let i of idx) {
            temp.push({id: i, cnt: c[i]});
        }
        // Sort
        temp.sort((a, b) => b.cnt - a.cnt);
        allCounts = allCounts.concat(temp);
        countsByType.push(temp);
        // Compute bins of counts
        histos.push(binGen(temp.map(t => t.cnt)));
    }
    return {allCounts, bins: histos, countsByType};
}

function isPointInBox(p, box) {
    const offX = p.x - box.x, offY = p.y - box.y;
    return (0 <= offX && offX <= box.width && 0 <= offY && offY <= box.height);
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
            const {graph, emb, emb2d} = action.data;
            draft.datasetId = action.data.datasetId;
            draft.graph = {
                nodes: graph.nodes,
                edges: graph.links,
                // coords: computeForceLayout(graph.nodes, graph.links, draft.spec.graph),
                nodeTypes: countNodesByType(graph.nodes),
            };
            populateNodeTypeIndex(graph.nodes, draft.graph.nodeTypes);
            mapColorToNodeType(draft.graph.nodeTypes);
            draft.graph.coords =  computeCircularLayout(graph.nodes, graph.links, draft.spec.graph, draft.centralNodeType);
            draft.graph.neighborMasksByType = getNeighborMasks(graph.nodes, graph.links, draft.graph.nodeTypes.length);
            draft.graph.neighborMasks = draft.graph.neighborMasksByType.map(m => m.reduce((acc, x) => acc.or(x), bs(0)));

            draft.latent = {
                emb,
                coords: coordsRescale(emb2d, draft.spec.latent.width, draft.spec.latent.height),
                nodeDist: getAllNodeDistance(emb, draft.graph.edges),
            };
            let binGen = histogram().domain([0, 1]).value(d => d.d).thresholds(50);
            draft.latent.distBinPresent = binGen(draft.latent.nodeDist.filter(d => d.p));
            draft.latent.distBinAbsent = binGen(draft.latent.nodeDist.filter(d => !d.p));
            // draft.latent.coords = runTSNE(draft.latent.distMat, draft.spec.latent);

            draft.isNodeSelected = (new Array(graph.nodes.length)).fill(false);
            return;

        case ACTION_TYPES.HIGHLIGHT_NODE_TYPE:
            if (action.nodeTypeIdx === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = {};
            } else {
                draft.highlightTrigger = {by: 'type', which: action.nodeTypeIdx};
                draft.isNodeHighlighted = draft.graph.nodes.map(n => n.typeId === action.nodeTypeIdx);
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NODES:
            draft.showDetailNode = action.nodeIdx;
            if (action.nodeIdx === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = {};
            } else {
                draft.highlightTrigger = {by: 'node', which: action.nodeIdx};
                draft.isNodeHighlighted = highlightNeighbors(draft.graph.nodes.length, draft.graph.neighborMasks, action.nodeIdx);
                draft.isNodeHighlighted[action.nodeIdx] = true;
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
                    if (draft.graph.nodes[i].typeId === draft.selectedNodeType && isPointInBox(c, action.selectionBox)) {
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
            draft.selectedCountsByType = countNeighborsByType(draft.graph.neighborMasksByType, draft.selectedNodes);
            if (draft.selectedNodes.length <= draft.powerSetLimit) {
                draft.neighborIntersections = computeIntersections(draft.graph.neighborMasksByType, draft.selectedNodes);
            }
            const temp = countNeighborSets(draft.graph.neighborMasksByType, draft.selectedNodes);
            draft.neighborCounts = temp.allCounts;
            draft.neighborCountsByType = temp.countsByType;
            draft.neighborCountsBins = temp.bins;
            draft.isNodeSelectedNeighbor = {};
            if (draft.neighborCounts) {
                for (let n of draft.neighborCounts) {
                    if (!draft.isNodeSelected[n.id]) {
                        draft.isNodeSelectedNeighbor[n.id] = n.cnt;
                    }
                }
            }
            return;
        case ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE:
            if (draft.selectedNodes.length > 0 && draft.graph.nodes[draft.selectedNodes[0]].typeId !== action.idx) {
                // Remove the current selection
                draft.selectedNodes = [];
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
            }
            draft.selectedNodeType = action.idx;
            return;
        case ACTION_TYPES.CHANGE_FILTER:
            if (action.inverse) {
                draft.filters[action.param] = !draft.filters[action.param];
            } else {
                draft.filters[action.param] = action.value;
            }
            return;

        default:
            return;
    }
}, initialState);


export default reducers;