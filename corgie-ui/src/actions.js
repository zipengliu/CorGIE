import "whatwg-fetch";
import * as Comlink from "comlink";
import { csvParseRows } from "d3";
import { getSelectedNeighbors } from "./utils";
import { computeNeighborMasks, computeEdgeDict } from "./utils";

import FocalLayoutWorker from "./focalLayout.worker";
import InitialLayoutWorker from "./initialLayout.worker";
import DistanceWorker from "./distance.worker";
// Note that this is a dirty and quick way to retrieve info about dataset
import datasetsInfo from "./datasets";

function findHopsInDatasetInfo(id) {
    const defaultHops = 1;
    for (let d of datasetsInfo) {
        if (d.id === id) {
            if (d.hops) {
                return parseInt(d.hops);
            }
            return defaultHops;
        }
    }
    return defaultHops;
}

const distanceWorker = Comlink.wrap(new DistanceWorker());
const focalLayoutWorker = Comlink.wrap(new FocalLayoutWorker());
const initalLayoutWorker = Comlink.wrap(new InitialLayoutWorker());

const ACTION_TYPES = {
    FETCH_DATA_PENDING: "FETCH_DATA_PENDING",
    FETCH_DATA_SUCCESS: "FETCH_DATA_SUCCESS",
    COMPUTE_INIT_LAYOUT_DONE: "COMPUTE_INIT_LAYOUT_DONE",
    FETCH_DATA_ERROR: "FETCH_DATA_ERROR",
    COMPUTE_DISTANCES_DONE: "COMPUTE_DISTANCES_DONE",
    HIGHLIGHT_NODES: "HIGHLIGHT_NODES",
    HIGHLIGHT_NODE_PAIRS: "HIGHLIGHT_NODE_PAIRS",
    HOVER_NODE: "HOVER_NODE",
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
    return async function (dispatch, getState) {
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

            const state = getState();
            const { neighborDistanceMetric } = state.param;
            const { numBins } = state.spec.scatterHist;
            const hops = findHopsInDatasetInfo(datasetId);
            // Filter the self-loops
            graph.links = graph.links.filter((e) => e.source !== e.target);
            graph.edgeDict = computeEdgeDict(graph.nodes.length, graph.links);
            Object.assign(graph, computeNeighborMasks(graph.nodes.length, graph.edgeDict, hops));

            focalLayoutWorker.initializeState(
                graph.nodes.length,
                graph.links,
                graph.neighborMasks.map((x) => x.toString()),
                hops,
                neighborDistanceMetric,
                state.spec.graph
            );

            dispatch(fetchDataSuccess({ datasetId, graph, emb, emb2d, attrs, features, hops }));

            initalLayoutWorker
                .computeForceLayoutWithD3(graph.nodes.length, graph.links, state.spec.graph.padding)
                .then((layoutRes) => {
                    dispatch(computeInitLayoutDone(layoutRes));
                });

            await distanceWorker.initializeState(
                emb,
                graph.nodes.length,
                graph.links,
                graph.neighborMasks.map((x) => x.toString()),
                neighborDistanceMetric,
                numBins
            );
            const sampleDistData = await distanceWorker.computeDistances(
                "sample",
                null,
                state.distances.maxSample
            );
            dispatch(computeDistancesDone(sampleDistData, 0));
            const edgeDistData = await distanceWorker.computeDistances("edge");
            dispatch(computeDistancesDone(edgeDistData, 1));
        } catch (e) {
            dispatch(fetchDataError(e));
        }
    };
}

function computeInitLayoutDone(layoutRes) {
    return { type: ACTION_TYPES.COMPUTE_INIT_LAYOUT_DONE, layoutRes };
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

function computeDistancesDone(distData, idx) {
    return { type: ACTION_TYPES.COMPUTE_DISTANCES_DONE, distData, idx };
}

export function highlightNodes(nodeIndices, brushedArea = null, fromView = null, which = null) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODES, nodeIndices, brushedArea, fromView, which };
}

export function highlightNodePairs(which, brushedArea, brushedPairs) {
    return { type: ACTION_TYPES.HIGHLIGHT_NODE_PAIRS, brushedArea, which, brushedPairs };
}

export function hoverNode(nodeIdx) {
    return { type: ACTION_TYPES.HOVER_NODE, nodeIdx };
}

export function toggleHighlightNodesAttr(delIdx = null) {
    return { type: ACTION_TYPES.TOGGLE_HIGHLIGHT_NODES_ATTR, delIdx };
}

// Mode could be one of CREATE, APPEND, DELETE, CLEAR, or REMOVE FROM
export function selectNodes(mode, targetNodes, targetGroupIdx) {
    // return { type: ACTION_TYPES.SELECT_NODES, nodeIdx, selectionBox, mode };
    return async function (dispatch, getState) {
        // Update state.selectedNodes before calling the layout in the worker
        const state = getState();
        const { selectedNodes, isNodeSelected } = state;
        // Deep copy the selectedNodes to avoid side effects
        let nondup;
        let newSel = selectedNodes.slice();
        switch (mode) {
            case "CREATE":
                nondup = targetNodes.filter((x) => !isNodeSelected[x]);
                if (nondup.length) {
                    newSel = [...selectedNodes, nondup];
                }
                break;
            case "APPEND":
                nondup = targetNodes.filter((x) => !isNodeSelected[x]);
                newSel[targetGroupIdx] = newSel[targetGroupIdx].concat(nondup);
                break;
            case "REMOVE FROM":
            case "SINGLE OUT":
                const isHighlighted = {};
                for (let nodeIdx of targetNodes) {
                    isHighlighted[nodeIdx] = true;
                }
                newSel = [];
                for (let gid = 0; gid < selectedNodes.length; gid++) {
                    let t = [];
                    for (let nodeIdx of selectedNodes[gid]) {
                        if (!isHighlighted.hasOwnProperty(nodeIdx)) {
                            t.push(nodeIdx);
                        }
                    }
                    if (t.length) {
                        newSel.push(t);
                    }
                }
                if (mode === "SINGLE OUT") {
                    newSel.push(targetNodes);
                }
                break;
            case "DELETE":
                newSel.splice(targetGroupIdx, 1);
                break;
            case "CLEAR":
                newSel = [];
                break;
            default:
                console.error("action selectNodes encountered the wrong mode: ", mode);
        }
        console.log("calling action.selectNodes() ", { mode, targetNodes, targetGroupIdx, newSel });

        const neighRes = getSelectedNeighbors(newSel, state.graph.neighborMasksByHop, state.param.hops);
        dispatch(selectNodesPending(newSel, neighRes));

        if (newSel.length) {
            let distGrpIdx = 2;
            if (newSel[0].length > 1) {
                dispatch(
                    computeDistancesDone(
                        await distanceWorker.computeDistances("within", newSel[0]),
                        distGrpIdx
                    )
                );
                distGrpIdx++;
            }
            if (newSel.length > 1 && newSel[1].length > 1) {
                dispatch(
                    computeDistancesDone(
                        await distanceWorker.computeDistances("within", newSel[1]),
                        distGrpIdx
                    )
                );
                distGrpIdx++;
            }
            if (newSel.length > 1 && (newSel[0].length > 1 || newSel[1].length > 1)) {
                dispatch(
                    computeDistancesDone(await distanceWorker.computeDistances("between", newSel), distGrpIdx)
                );
            }

            const layoutRes = await callFocalLayoutFunc(
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

        const neighRes = getSelectedNeighbors(newSel, state.graph.neighborMasksByHop, state.param.hops);
        dispatch(selectNodesPending(newSel, neighRes));

        const layoutRes = await callFocalLayoutFunc(
            state.graph,
            newSel,
            neighRes,
            state.param,
            state.spec.graph
        );
        dispatch(selectNodesDone(layoutRes));
    };
}

async function callFocalLayoutFunc(graph, selectedNodes, neighRes, param, spec) {
    // Compute the force layout for focal nodes (selected + k-hop neighbors)
    if (selectedNodes.length === 0) {
        return {};
    } else {
        // Serialize the bitset data structure to pass it to the web worker
        const { neighMap } = neighRes;
        let serializedNeighMap = {};
        for (let id in neighMap)
            if (neighMap.hasOwnProperty(id)) {
                serializedNeighMap[id] = neighMap[id].mask.toArray();
            }

        switch (param.focalGraph.layout) {
            case "umap":
                return await focalLayoutWorker.computeFocalLayoutWithUMAP(
                    selectedNodes,
                    neighRes.neighArr,
                    // serializedNeighMap,   // Use local signature
                    // graph.neighborMasksByHop[0].map((x) => x.toArray()), // Use global signature
                    null,
                    param.nodeSize,
                    param.focalGraph.useEdgeBundling,
                );
            case "group-constraint-cola":
                return await focalLayoutWorker.computeFocalLayoutWithCola(
                    selectedNodes,
                    neighRes.neighArr,
                    // serializedNeighMap,
                    null,
                    param.nodeSize
                );
            case "spiral":
                return await focalLayoutWorker.computeSpaceFillingCurveLayout(
                    graph.nodes,
                    param.hops,
                    neighRes.isNodeSelected,
                    neighRes.isNodeSelectedNeighbor,
                    neighRes.neighArr,
                    serializedNeighMap,
                    param.neighborDistanceMetric
                );
            default:
                return await focalLayoutWorker.computeFocalLayoutWithD3(
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
