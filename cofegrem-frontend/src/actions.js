import 'whatwg-fetch';
import {csvParse, csvParseRows} from 'd3-dsv';


const ACTION_TYPES = {
    FETCH_DATA_PENDING: 'FETCH_DATA_PENDING',
    FETCH_DATA_SUCCESS: 'FETCH_DATA_SUCCESS',
    FETCH_DATA_ERROR: 'FETCH_DATA_ERROR',
    HIGHLIGHT_NODE_TYPE: 'HIGHLIGHT_NODE_TYPE',
    HIGHLIGHT_NODES: 'HIGHLIGHT_NODES',
};
export default ACTION_TYPES;


export function fetchGraphData(whichDataset) {
    return async function(dispatch) {
        const where = `/data/${whichDataset}`;
        dispatch(fetchDataPending());

        try {
            let [graph, emb] = [
                // await fetch(`${where}/dataframe.csv`).then(r => r.text()).then(csvParse),
                // await fetch(`${where}/nodes.csv`).then(r => r.text()).then(csvParse),
                // await fetch(`${where}/edges.csv`).then(r => r.text()).then(csvParse),
                await fetch(`${where}/graph.json`).then(r => r.json()),
                await fetch(`${where}/embeddings.txt`).then(r => r.text()).then(csvParseRows),
            ];
            console.log(graph);
            // console.log(dataRows);
            // console.log(nodes);
            // console.log(edges);

            dispatch(fetchDataSuccess({graph, emb}));
        } catch (e) {
            dispatch(fetchDataError(e));
        }
    }
}

function fetchDataPending() {
    return {type: ACTION_TYPES.FETCH_DATA_PENDING};
}

function fetchDataSuccess(data) {
    return {type: ACTION_TYPES.FETCH_DATA_SUCCESS, data};
}

function fetchDataError(error) {
    return {type: ACTION_TYPES.FETCH_DATA_ERROR, error: error.toString()};
}

export function highlightNodeType(nodeType) {
    return {type: ACTION_TYPES.HIGHLIGHT_NODE_TYPE, nodeType};
}

export function highlightNodes(nodeIdx) {
    return {type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIdx};
}