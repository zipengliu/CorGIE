import produce from 'immer';
import initialState from "./initialState";
import ACTION_TYPES from './actions';
import {getDistanceMatrixFromEmbeddings, runTSNE, computeForceLayout} from './layouts';
import {schemeTableau10} from 'd3-scale-chromatic';

function mapColorToNodeType(nodeTypes) {
    // console.log(schemeTableau10);
    let colorScheme = {}, colorIdx = 0;
    for (let t in nodeTypes) {
        if (colorIdx > schemeTableau10.length - 1) {
            colorScheme[t] = 'grey';
        } else {
            colorScheme[t] = schemeTableau10[colorIdx];
            colorIdx++;
        }
    }
    return colorScheme;
}

function countNodesByType(nodes) {
    let counts = {};
    for (let n of nodes) {
        if (!counts.hasOwnProperty(n.type)) {
            counts[n.type] = 0;
        }
        counts[n.type]++;
    }
    return counts;
}

function getNeighbors(edges, targetNodeIdx) {
    let nei = [];
    for (let e of edges) {
        if (e.source.index === targetNodeIdx) {
            nei.push(e.target.index);
        } else if (e.target.index === targetNodeIdx) {
            nei.push(e.source.index);
        }
    }
    return nei;
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
            draft.dataRows = action.data.dataRows;
            draft.graph = {
                nodes: action.data.nodes,
                edges: action.data.edges,
                coords: computeForceLayout(action.data.nodes, action.data.edges, draft.spec.graph),
                countsByType: countNodesByType(action.data.nodes),
            };
            draft.graph.colorScheme = mapColorToNodeType(draft.graph.countsByType);
            draft.latent = {
                emb: action.data.emb,
                distMat: getDistanceMatrixFromEmbeddings(action.data.emb),
            };
            draft.latent.coords = runTSNE(draft.latent.distMat, draft.spec.latent);
            return;
        case ACTION_TYPES.HIGHLIGHT_NODE_TYPE:
            draft.highlightedType = action.nodeType;
            return;
        case ACTION_TYPES.HIGHLIGHT_NODES:
            // TODO: expand the highlight to its neighbors
            draft.highlightedNodes = action.nodeIdx !== null?
                [action.nodeIdx, ...getNeighbors(draft.graph.edges, action.nodeIdx)]: [];
            draft.showDetailNode = action.nodeIdx;
            return;
        default:
            return;
    }
}, initialState);


export default reducers;