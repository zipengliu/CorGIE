import "whatwg-fetch";
import { csvParseRows } from "d3-dsv";
import { isPointInBox, getSelectedNeighbors } from "./utils";

// eslint-disable-next-line import/no-webpack-loader-syntax
import worker from "workerize-loader!./worker";

let workerInstance = new worker();

const ACTION_TYPES = {
    FETCH_DATA_PENDING: "FETCH_DATA_PENDING",
    FETCH_DATA_SUCCESS: "FETCH_DATA_SUCCESS",
    FETCH_DATA_ERROR: "FETCH_DATA_ERROR",
    COMPUTE_DISTANCES_DONE: "COMPUTE_DISTANCES_DONE",
    HIGHLIGHT_NODES: "HIGHLIGHT_NODES",
    HIGHLIGHT_NODE_PAIRS: "HIGHLIGHT_NODE_PAIRS",
    HOVER_NODE: "HOVER_NODE",
    HIGHLIGHT_NEIGHBORS: "HIGHLIGHT_NEIGHBORS",
    CHANGE_SELECTED_NODE_TYPE: "CHANGE_SELECTED_NODE_TYPE",
    SELECT_NODES: "SELECT_NODES",
    SELECT_NODES_PENDING: "SELECT_NODES_PENDING",
    SELECT_NODES_DONE: "SELECT_NODES_DONE",
    SELECT_NODE_PAIR: "SELECT_NODE_PAIR",
    CHANGE_PARAM: "CHANGE_PARAM",
    CHANGE_HOPS: "CHANGE_HOPS",
    LAYOUT_TICK: "LAYOUT_TICK",
    CHANGE_EDGE_TYPE_STATE: "CHANGE_EDGE_TYPE_STATE",
    TOGGLE_HIGHLIGHT_NODES_ATTR: "TOGGLE_HIGHLIGHT_NODES_ATTR",
    SEARCH_NODES: "SEARCH_NODES",
};
export default ACTION_TYPES;

export function fetchGraphData(homePath, datasetId) {
    return async function (dispatch) {
        const where = `${homePath}/data/${datasetId}`;
        console.log("fetching data from ", where);

        dispatch(fetchDataPending());

        try {
            let [graph, emb, emb2d, attrs, features] = [
                await fetch(`${where}/graph.json`).then((r) => r.json()),
                await fetch(`${where}/node-embeddings.csv`)
                    .then((r) => r.text())
                    .then(csvParseRows),
                await fetch(`${where}/umap.csv`)
                    .then((r) => r.text())
                    .then(csvParseRows)
                    .then((d) => d.map((x) => [parseFloat(x[0]), parseFloat(x[1])])),
                await fetch(`${where}/attr-meta.json`)
                    .then((r) => r.json())
                    .catch(() => {
                        return []; // In case there is no meta data
                    }),
                await fetch(`${where}/features.csv`)
                    .then((r) => r.text())
                    .then(csvParseRows)
                    .then((d) => {
                        if (isNaN(d[0][0])) {
                            throw new Error();
                        }
                        // Check if integer or float
                        const func = d[0][0] % 1 == 0 ? parseInt : parseFloat;
                        // Convert a 2D matrix of numbers
                        return d.map((row) => row.map((x) => func(x)));
                    })
                    .catch(() => {
                        return null; // In case there is no meta data
                    }),
            ];

            dispatch(fetchDataSuccess({ datasetId, graph, emb, emb2d, attrs, features }));

            let distData = await workerInstance.getDistancesOfAllPairs(emb);
            dispatch(computeDistancesDone(distData));
        } catch (e) {
            dispatch(fetchDataError(e));
        }
    };
}

function fetchDataPending() {
    return { type: ACTION_TYPES.FETCH_DATA_PENDING };
}

function fetchDataSuccess(data) {
    return { type: ACTION_TYPES.FETCH_DATA_SUCCESS, data };
}

function fetchDataError(error) {
    return { type: ACTION_TYPES.FETCH_DATA_ERROR, error: error.toString() };
}

function computeDistancesDone(distData) {
    return { type: ACTION_TYPES.COMPUTE_DISTANCES_DONE, distData };
}

export function highlightNodes(nodeIndices, brushedArea = null, fromView = null, which = null) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIndices, brushedArea, fromView, which };
}

export function highlightNodePairs(which, v1, v2) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODE_PAIRS, brushedRange: [v1, v2], which };
}

export function hoverNode(nodeIdx) {
    return { type: ACTION_TYPES.HOVER_NODE, nodeIdx };
}

export function toggleHighlightNodesAttr(delIdx = null) {
    return { type: ACTION_TYPES.TOGGLE_HIGHLIGHT_NODES_ATTR, delIdx };
}

export function highlightNeighbors(nodes) {
    return { type: ACTION_TYPES.HIGHLIGHT_NEIGHBORS, nodes };
}

// Mode could be one of CREATE, APPEND, DELETE, or CLEAR
export function selectNodes(mode, targetNodes, targetGroupIdx) {
    // return { type: ACTION_TYPES.SELECT_NODES, nodeIdx, selectionBox, mode };
    return async function (dispatch, getState) {
        // Update state.selectedNodes before calling the layout in the worker
        const state = getState();
        const { selectedNodes } = state;
        // Deep copy the selectedNodes to avoid side effects
        let newSel = selectedNodes.map((x) => x.slice());

        if (mode === "CREATE") {
            // Create a new selection
            newSel.push(targetNodes);
        } else if (mode === "APPEND") {
            // TODO append
            console.assert(targetGroupIdx !== null);
            newSel[targetGroupIdx] = newSel[targetGroupIdx].concat(targetGroupIdx);
        } else if (mode === "DELETE") {
            console.assert(targetGroupIdx !== null);
            console.log("delete ", targetGroupIdx);
            newSel.splice(targetGroupIdx, 1);
        } else if (mode === "CLEAR") {
            newSel = [];
        } else {
            console.error("action selectNodes encountered the wrong mode: ", mode);
        }

        const neighRes = getSelectedNeighbors(newSel, state.graph.neigh, state.param.hops);
        dispatch(selectNodesPending(newSel, neighRes));

        if (newSel.length) {
            const layoutRes = await callLocalLayoutFunc(
                state.graph,
                newSel,
                neighRes,
                state.param,
                state.spec.graph
            );
            dispatch(selectNodesDone(layoutRes));
        } else {
            dispatch(selectNodesDone({}));
        }
    };
}

export function selectNodePair(node1, node2) {
    return async function (dispatch, getState) {
        const state = getState();
        let newSel = [[node1], [node2]];

        const neighRes = getSelectedNeighbors(newSel, state.graph.neigh, state.param.hops);
        dispatch(selectNodesPending(newSel, neighRes));

        const layoutRes = await callLocalLayoutFunc(
            state.graph,
            newSel,
            neighRes,
            state.param,
            state.spec.graph
        );
        dispatch(selectNodesDone(layoutRes));
    };
}

async function callLocalLayoutFunc(graph, selectedNodes, neighRes, param, spec) {
    console.log("Calling local layout function...");
    // Compute the force layout for focal nodes (selected + k-hop neighbors)
    if (selectedNodes.length === 0) {
        return {};
    } else {
        // Serialize the bitset data structure to pass it to the web worker
        const { neighMap } = neighRes;
        let serializedNeighMap = {};
        for (let id in neighMap)
            if (neighMap.hasOwnProperty(id)) {
                // TODO can use Unit8Array to compress it
                serializedNeighMap[id] = neighMap[id].mask.toArray();
            }

        switch (param.focalGraph.layout) {
            case "group-constraint-cola":
                return await workerInstance.computeLocalLayoutWithCola(
                    graph.nodes,
                    graph.edges,
                    param.hops,
                    neighRes.isNodeSelected,
                    neighRes.isNodeSelectedNeighbor,
                    neighRes.neighGrp,
                    serializedNeighMap,
                    param.neighborDistanceMetric,
                    spec.graph
                );
            case "umap":
                return await workerInstance.computeLocalLayoutWithUMAP(
                    graph.nodes,
                    // graph.edges,
                    param.hops,
                    selectedNodes,
                    neighRes.isNodeSelected,
                    neighRes.isNodeSelectedNeighbor,
                    neighRes.neighArr,
                    // serializedNeighMap,   // Use local signature
                    graph.neigh[0].map((x) => x.toArray()), // Use global signature
                    param.neighborDistanceMetric,
                    spec.graph
                );
            case "spiral":
                return await workerInstance.computeSpaceFillingCurveLayout(
                    graph.nodes,
                    param.hops,
                    neighRes.isNodeSelected,
                    neighRes.isNodeSelectedNeighbor,
                    neighRes.neighArr,
                    serializedNeighMap,
                    param.neighborDistanceMetric
                );
            default:
                return await workerInstance.computeLocalLayoutWithD3(
                    graph.nodes,
                    graph.edges,
                    param.hops,
                    neighRes.isNodeSelected,
                    neighRes.isNodeSelectedNeighbor,
                    serializedNeighMap,
                    param.neighborDistanceMetric,
                    spec.graph
                );
        }
    }
}

export function selectNodesPending(newSel, neighRes) {
    return { type: ACTION_TYPES.SELECT_NODES_PENDING, newSel, neighRes };
}

export function selectNodesDone(layoutRes) {
    return { type: ACTION_TYPES.SELECT_NODES_DONE, layoutRes };
}

export function changeSelectedNodeType(idx) {
    return { type: ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE, idx: parseInt(idx, 10) };
}

export function changeParam(param, value, inverse = false, arrayIdx = null) {
    return { type: ACTION_TYPES.CHANGE_PARAM, param, value, inverse, arrayIdx };
}

export function changeHops(hops) {
    return { type: ACTION_TYPES.CHANGE_HOPS, hops };
}

export function layoutTick() {
    return { type: ACTION_TYPES.LAYOUT_TICK };
}

export function changeEdgeTypeState(idx) {
    return { type: ACTION_TYPES.CHANGE_EDGE_TYPE_STATE, idx };
}

export function searchNodes(label, nodeIdx) {
    return { type: ACTION_TYPES.SEARCH_NODES, label, nodeIdx };
}
