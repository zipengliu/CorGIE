import "whatwg-fetch";
import { csvParseRows } from "d3-dsv";

const ACTION_TYPES = {
    FETCH_DATA_PENDING: "FETCH_DATA_PENDING",
    FETCH_DATA_SUCCESS: "FETCH_DATA_SUCCESS",
    FETCH_DATA_ERROR: "FETCH_DATA_ERROR",
    HIGHLIGHT_NODE_TYPE: "HIGHLIGHT_NODE_TYPE",
    HIGHLIGHT_NODES: "HIGHLIGHT_NODES",
    HIGHLIGHT_NEIGHBORS: "HIGHLIGHT_NEIGHBORS",
    CHANGE_SELECTED_NODE_TYPE: "CHANGE_SELECTED_NODE_TYPE",
    SELECT_NODES: "SELECT_NODES",
    SELECT_EDGE: "SELECT_EDGE",
    CHANGE_PARAM: "CHANGE_PARAM",
    CHANGE_HOPS: "CHANGE_HOPS",
    LAYOUT_TICK: "LAYOUT_TICK",
    CHANGE_EDGE_TYPE_STATE: "CHANGE_EDGE_TYPE_STATE",
    TOGGLE_HIGHLIGHT_NODES_ATTR: "TOGGLE_HIGHLIGHT_NODES_ATTR",
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
                        const func = d[0][0] % 1 == 0? parseInt: parseFloat
                        // Convert a 2D matrix of numbers
                        return d.map(row => row.map(x => func(x)));
                    })
                    .catch(() => {
                        return null; // In case there is no meta data
                    }),
            ];

            dispatch(fetchDataSuccess({ datasetId, graph, emb, emb2d, attrs, features }));
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

export function highlightNodeType(nodeTypeIdx) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODE_TYPE, nodeTypeIdx };
}

export function highlightNodes(nodeIdx, selectionBox = null, appendMode = false, selectionBoxView = null) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIdx, selectionBox, selectionBoxView, appendMode };
}

export function toggleHighlightNodesAttr(delIdx = null) {
    return { type: ACTION_TYPES.TOGGLE_HIGHLIGHT_NODES_ATTR, delIdx };
}

export function highlightNeighbors(nodes) {
    return { type: ACTION_TYPES.HIGHLIGHT_NEIGHBORS, nodes };
}

export function selectNodes(nodeIdx, selectionBox = null, mode = 'CREATE') {
    return { type: ACTION_TYPES.SELECT_NODES, nodeIdx, selectionBox, mode };
}

export function selectEdge(eid) {
    return { type: ACTION_TYPES.SELECT_EDGE, eid };
}

export function changeSelectedNodeType(idx) {
    return { type: ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE, idx: parseInt(idx, 10) };
}

export function changeParam(param, value, inverse = false) {
    return { type: ACTION_TYPES.CHANGE_PARAM, param, value, inverse };
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
