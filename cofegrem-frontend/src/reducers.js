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

function highlightNeighbors(n, edges, targetNodeIdx) {
    let h = (new Array(n)).fill(false);
    for (let e of edges) {
        if (e.source.index === targetNodeIdx) {
            h[e.target.index] = true;
        } else if (e.target.index === targetNodeIdx) {
            h[e.source.index] = true;
        }
    }
    return h;
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
            const {graph, emb} = action.data;
            draft.graph = {
                nodes: graph.nodes,
                edges: graph.links,
                coords: computeForceLayout(graph.nodes, graph.links, draft.spec.graph),
                countsByType: countNodesByType(graph.nodes),
            };
            draft.graph.colorScheme = mapColorToNodeType(draft.graph.countsByType);
            draft.latent = {
                emb,
                distMat: getDistanceMatrixFromEmbeddings(emb),
            };
            draft.latent.coords = runTSNE(draft.latent.distMat, draft.spec.latent);
            return;
        case ACTION_TYPES.HIGHLIGHT_NODE_TYPE:
            if (action.nodeType === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = null;
            } else {
                draft.highlightTrigger = {by: 'type', which: action.nodeType};
                draft.isNodeHighlighted = draft.graph.nodes.map(n => n.type === action.nodeType);
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NODES:
            draft.showDetailNode = action.nodeIdx;
            if (action.nodeIdx === null) {
                draft.highlightTrigger = null;
                draft.isNodeHighlighted = null;
            } else {
                draft.highlightTrigger = {by: 'node', which: action.nodeIdx};
                draft.isNodeHighlighted = highlightNeighbors(draft.graph.nodes.length, draft.graph.edges, action.nodeIdx);
            }
            return;
        default:
            return;
    }
}, initialState);


export default reducers;