import 'whatwg-fetch';
import {csvParseRows} from 'd3-dsv';


const ACTION_TYPES = {
    FETCH_DATA_PENDING: 'FETCH_DATA_PENDING',
    FETCH_DATA_SUCCESS: 'FETCH_DATA_SUCCESS',
    FETCH_DATA_ERROR: 'FETCH_DATA_ERROR',
    HIGHLIGHT_NODE_TYPE: 'HIGHLIGHT_NODE_TYPE',
    HIGHLIGHT_NODES: 'HIGHLIGHT_NODES',
    CHANGE_SELECTED_NODE_TYPE: 'CHANGE_SELECTED_NODE_TYPE',
    SELECT_NODES: 'SELECT_NODES',
};
export default ACTION_TYPES;


export function fetchGraphData(whichDataset) {
    return async function(dispatch) {
        const homepagePath = '';
        // const homepagePath = '/~zipeng/private/cofegrem-prototype';
        const where = `${homepagePath}/data/${whichDataset}`;
        dispatch(fetchDataPending());

        try {
            let [graph, emb, emb2d] = [
                // await fetch(`${where}/dataframe.csv`).then(r => r.text()).then(csvParse),
                // await fetch(`${where}/nodes.csv`).then(r => r.text()).then(csvParse),
                // await fetch(`${where}/edges.csv`).then(r => r.text()).then(csvParse),
                await fetch(`${where}/graph.json`).then(r => r.json()),
                await fetch(`${where}/embeddings.txt`).then(r => r.text()).then(csvParseRows),
                await fetch(`${where}/embeddings-2d.txt`).then(r => r.text()).then(csvParseRows)
                    .then(d => d.map(x => ([parseFloat(x[0]), parseFloat(x[1])]))),
            ];
            console.log(graph);

            dispatch(fetchDataSuccess({graph, emb, emb2d}));
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

export function highlightNodeType(nodeTypeIdx) {
    return {type: ACTION_TYPES.HIGHLIGHT_NODE_TYPE, nodeTypeIdx};
}

export function highlightNodes(nodeIdx) {
    return {type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIdx};
}

export function selectNodes(nodeIdx, selectionBox=null, appendMode=false) {
    return {type: ACTION_TYPES.SELECT_NODES, nodeIdx, selectionBox, appendMode};
}

export function changeSelectedNodeType(idx) {
    return {type: ACTION_TYPES.CHANGE_SELECTED_NODE_TYPE, idx: parseInt(idx, 10)};
}