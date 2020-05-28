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
    CHANGE_PARAM: "CHANGE_PARAM",
    CHANGE_HOPS: "CHANGE_HOPS",
    LAYOUT_TICK: "LAYOUT_TICK",
};
export default ACTION_TYPES;

export function fetchGraphData(homePath, datasetId) {
    return async function (dispatch) {
        const where = `${homePath}/data/${datasetId}`;
        console.log("fetching data from ", where);

        dispatch(fetchDataPending());

        try {
            let [graph, emb, emb2d] = [
                await fetch(`${where}/graph.json`).then((r) => r.json()),
                await fetch(`${where}/node-embedding.csv`)
                    .then((r) => r.text())
                    .then(csvParseRows),
                await fetch(`${where}/umap.csv`)
                    .then((r) => r.text())
                    .then(csvParseRows)
                    .then((d) => d.map((x) => [parseFloat(x[0]), parseFloat(x[1])])),
            ];

            dispatch(fetchDataSuccess({ datasetId, graph, emb, emb2d }));
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

export function highlightNodes(nodeIdx) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIdx };
}

export function highlightNeighbors(nodes) {
    return { type: ACTION_TYPES.HIGHLIGHT_NEIGHBORS, nodes };
}

export function selectNodes(nodeIdx, selectionBox = null, appendMode = false) {
    return { type: ACTION_TYPES.SELECT_NODES, nodeIdx, selectionBox, appendMode };
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
