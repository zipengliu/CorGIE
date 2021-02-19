import produce, { freeze } from "immer";
import initialState from "./initialState";
import ACTION_TYPES from "./actions";
import { computeForceLayoutWithD3, computeDummyLayout, computeForceLayoutWithCola } from "./layouts";
import { schemeCategory10 } from "d3";
import bs from "bitset";
import {
    bin as d3bin,
    extent,
    max,
    scaleSequential,
    interpolateGreens,
    interpolateGreys,
    interpolateRdBu,
    scaleLinear,
} from "d3";
import Quadtree from "@timohausmann/quadtree-js";
import {
    aggregateBinaryFeatures,
    compressFeatureValues,
    coordsRescale,
    getNeighborDistance,
    binarySearch,
    getNodeEmbeddingColor,
    rectBinning,
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

function getNeighborMasksByType(nodes, edges, numberOfNodeTypes) {
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

function getNeighbors(neighborMasks, hops, edgeDict, targetNodes, incTargets = true) {
    const hash = {};
    if (incTargets) {
        for (let tar of targetNodes) {
            hash[tar] = true;
        }
    }

    for (let i = 0; i < hops; i++) {
        // Iterate the hops
        // Flatten all hops / treating all hops the same
        for (let tar of targetNodes) {
            for (let id of neighborMasks[i][tar].toArray()) {
                hash[id] = true;
            }
        }
    }
    const nodes = Object.keys(hash).map((x) => parseInt(x));
    return { nodes, edges: getEdgesWithinGroup(edgeDict, nodes, hash) };
}

function getEdgesWithinGroup(edgeDict, nodes, nodeHash = null) {
    let h = nodeHash;
    if (nodeHash === null) {
        h = {};
        for (let id of nodes) {
            h[id] = true;
        }
    }

    const edges = [];
    for (let id of nodes) {
        for (let id2 of edgeDict[id]) {
            if (id < id2 && h[id2]) {
                edges.push({ source: id, target: id2 });
            }
        }
    }
    return edges;
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

// function computeIntersections(neighborMasksByType, selectedNodes) {
//     if (selectedNodes.length < 2) {
//         return null;
//     }
//     const combos = generateIntersectionCombo(selectedNodes.length);
//     let intersections = [];
//     // This is potentially slow due to spatial locality
//     // And the combo bitset is duped
//     for (let i = 0; i < neighborMasksByType[0].length; i++) {
//         intersections.push(
//             combos.map((c) => {
//                 const bits = c.toArray();
//                 let r = bs(0).flip();
//                 for (let b of bits) {
//                     const nodeIdx = selectedNodes[b];
//                     r = r.and(neighborMasksByType[nodeIdx][i]);
//                 }
//                 return { combo: c, res: r, size: r.cardinality() };
//             })
//         );
//     }
//     return intersections;
// }

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
    const binGen = d3bin().thresholds(selectedNodes.length);

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

// function computeDistanceToCurrentFocus(distMatrix, focalNodes) {
//     if (focalNodes.length === 0) {
//         return null;
//     }
//     const d = [];
//     for (let i = 0; i < distMatrix.length; i++) {
//         let t = 0;
//         for (let nodeId of focalNodes) {
//             t += distMatrix[i][nodeId];
//         }
//         d.push(t / focalNodes.length);
//     }
//     console.log({ extent: extent(d) });
//     return d;
// }

function callLayoutFunc(nodes, edges, whichLayout, spec) {
    let layoutRes;
    // No point of computing any global layout for a large graph
    if (nodes.length > 1000) {
        layoutRes = computeDummyLayout(nodes);
    } else {
        if (whichLayout === "force-directed-d3") {
            // Make a copy of the edges to prevent them from changes by the force simulation
            layoutRes = computeForceLayoutWithD3(nodes, edges);
        } else if (whichLayout === "force-directed-cola") {
            layoutRes = computeForceLayoutWithCola(nodes, edges, spec);
        } else {
            layoutRes = computeDummyLayout(nodes);
        }
    }
    return layoutRes;
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
                a.binGen = d3bin().domain(s.domain()).thresholds(s.ticks(thresCnt));
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

// distBuf: Float32Array.  srcBuf and tgtBuf: Uint16Array.
const processDistCompResults = (distRes, numNodes) => {
    const { distBuf, srcBuf, tgtBuf, binsLatent, binsTopo, gridBins, gridBinsMaxCnt } = distRes;
    // Init distance matrix
    const distMatLatent = {},
        distMatTopo = {};
    for (let i = 0; i < numNodes; i++) {
        distMatLatent[i] = { [i]: 0 };
        distMatTopo[i] = { [i]: 0 };
    }
    const scatterHistAll = {
        name: "all",
        title: "all",
        dist: [],
        src: srcBuf,
        tgt: tgtBuf,
        binsLatent,
        binsTopo,
        gridBins,
        gridBinsMaxCnt,
    };
    for (let i = 0; i < srcBuf.length; i++) {
        const s = srcBuf[i],
            t = tgtBuf[i];
        const dTopo = distBuf[2 * i + 1],
            dLat = distBuf[2 * i];
        distMatLatent[s][t] = dLat;
        distMatLatent[t][s] = dLat;
        distMatTopo[s][t] = dTopo;
        distMatTopo[t][s] = dTopo;
        scatterHistAll.dist.push([dLat, dTopo]);
    }
    return { distMatLatent, distMatTopo, scatterHistAll };
};

const computeScatterHistData = (distData, whichSubset, ref, numBins) => {
    const { distMatTopo, distMatLatent, binGen } = distData;
    let data = {
        name: whichSubset,
        dist: [],
        src: [],
        tgt: [],
        binsLatent: null,
        binsTopo: null,
    };
    let binRes;

    if (whichSubset === "edge") {
        // Ref should be edges
        data.dist = ref.map((e) => [distMatLatent[e.source][e.target], distMatTopo[e.source][e.target]]);
        data.title = "those connected by edges";
        data.src = ref.map((e) => e.source);
        data.tgt = ref.map((e) => e.target);
    } else if (whichSubset.includes("between")) {
        for (let i = 0; i < ref[0].length; i++) {
            for (let j = 0; j < ref[1].length; j++) {
                data.dist.push([distMatLatent[ref[0][i]][ref[1][j]], distMatTopo[ref[0][i]][ref[1][j]]]);
                data.src.push(ref[0][i]);
                data.tgt.push(ref[1][j]);
            }
        }
        data.title = "those between foc-0 and foc-1";
    } else if (whichSubset.includes("foc")) {
        for (let i = 0; i < ref.length; i++) {
            for (let j = i + 1; j < ref.length; j++) {
                data.dist.push([distMatLatent[ref[i]][ref[j]], distMatTopo[ref[i]][ref[j]]]);
                data.src.push(ref[i]);
                data.tgt.push(ref[j]);
            }
        }
        data.title = `those within ${whichSubset}`;
    }
    binRes = rectBinning(data.dist, [1, 1], numBins);
    Object.assign(data, {
        binsLatent: binGen(data.dist.map((x) => x[0])),
        binsTopo: binGen(data.dist.map((x) => x[1])),
        gridBins: binRes.bins,
        gridBinsMaxCnt: binRes.maxCnt,
    });
    return data;
};

// const getIntraDistances = (nodes, distMatrix) => {
//     const n = nodes.length;
//     const d = [];
//     for (let i = 0; i < n; i++) {
//         for (let j = i + 1; j < n; j++) {
//             d.push([distMatrix[nodes[i]][nodes[j]], nodes[i], nodes[j]]);
//         }
//     }
//     d.sort((x1, x2) => x1[0] - x2[0]);
//     return d;
// };

// // Return the distance distributions for the focal groups
// // In the case of two focal group with only one node in each, return one distance value
// function computeDistancesFocal(selectedNodes, distMatrix, binGen) {
//     let res = [];
//     if (selectedNodes.length == 1 && selectedNodes[0].length > 1) {
//         const d = {
//             mode: "within focal group",
//             nodePairs: getIntraDistances(selectedNodes[0], distMatrix),
//         };
//         d.bins = binGen(d.nodePairs.map((x) => x[0]));
//         res.push(d);
//     } else if (selectedNodes.length > 1) {
//         for (let k = 0; k < selectedNodes.length; k++) {
//             if (selectedNodes[k].length > 1) {
//                 const d = {
//                     mode: `within focal group ${k}`,
//                     nodePairs: getIntraDistances(selectedNodes[k], distMatrix),
//                 };
//                 d.bins = binGen(d.nodePairs.map((x) => x[0]));
//                 res.push(d);
//             }
//         }
//         if (selectedNodes.length == 2) {
//             const n1 = selectedNodes[0].length,
//                 n2 = selectedNodes[1].length;
//             if (n1 > 1 || n2 > 1) {
//                 const d2 = { mode: "between two focal groups", nodePairs: [] };
//                 for (let i = 0; i < n1; i++) {
//                     for (let j = 0; j < n2; j++) {
//                         const a = selectedNodes[0][i],
//                             b = selectedNodes[1][j];
//                         d2.nodePairs.push([distMatrix[a][b], a, b]);
//                     }
//                 }
//                 d2.bins = binGen(d2.nodePairs.map((x) => x[0]));
//                 res.push(d2);
//             } else if (n1 == 1 && n2 == 1) {
//                 res = distMatrix[selectedNodes[0][0]][selectedNodes[1][0]];
//             }
//         }
//     }
//     return res;
// }

function setNodeColors(draft, colorBy) {
    if (colorBy === -1) {
        draft.nodeColors = draft.latent.posColor;
        draft.param.colorScale = null;
    } else {
        const colorAttr = draft.nodeAttrs[colorBy];
        const attrDomain = [colorAttr.bins[0].x0, colorAttr.bins[colorAttr.bins.length - 1].x1];
        const leftMargin = 0.2 * (attrDomain[1] - attrDomain[0]);
        draft.param.colorScale = scaleSequential(interpolateGreens).domain([
            attrDomain[0] > 0 ? Math.max(0, attrDomain[0] - leftMargin) : attrDomain[0],
            attrDomain[1],
        ]);
        draft.param.colorBy = colorAttr.name; // Use the attribute name as colorBy for convinience
        draft.nodeColors = draft.graph.nodes.map((n) =>
            n.hasOwnProperty(colorAttr.name) ? draft.param.colorScale(n[colorAttr.name]) : "grey"
        );
    }
}

const reducers = produce((draft, action) => {
    const ascFunc = (x1, x2) => x1[0][0] - x2[0][0],
        descFunc = (x1, x2) => x2[0][0] - x1[0][0];
    let neiRes;
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
                edgeDict: graph.edgeDict,
                neighborMasks: graph.neighborMasks,
                neighborMasksByHop: graph.neighborMasksByHop,
                nodeTypes: countNodesByType(graph.nodes),
                features,
            };
            draft.featureAgg = {
                cnts: null,
            };
            if (features && features[0][0] % 1 == 0) {
                // is binary features
                draft.featureAgg.cnts = aggregateBinaryFeatures(features, null);
                draft.featureAgg.maxCnts = max(draft.featureAgg.cnts);
                draft.featureAgg.compressedCnts = compressFeatureValues(
                    draft.featureAgg.cnts,
                    draft.spec.feature.maxNumBars
                );
                draft.featureAgg.scale = scaleSequential(interpolateGreys).domain([
                    0,
                    draft.featureAgg.maxCnts,
                ]);
            }
            populateNodeTypeIndex(graph.nodes, draft.graph.nodeTypes);
            mapColorToNodeType(draft.graph.nodeTypes);
            draft.initialLayout = callLayoutFunc(
                draft.graph.nodes,
                draft.graph.edges,
                draft.param.graph.layout,
                draft.spec.graph
            ); // TODO make this async

            // draft.graph.neighborMasksByHop = getNeighborMasksByHop(graph.nodes, graph.links, draft.param.hops);
            draft.graph.neighborMasksByType = getNeighborMasksByType(
                graph.nodes,
                graph.links,
                draft.graph.nodeTypes.length,
                draft.param.hops
            );
            // Bug: only 1-hop is counted in the neighborMasksByType
            // draft.graph.neighborMasks = draft.graph.neighborMasksByType.map((m) =>
            //     m.reduce((acc, x) => acc.or(x), bs(0))
            // );
            // draft.graph.neighborMasks = computeNeighborMasks(draft.graph.nodes.length, draft.graph.edgeDict, draft.param.hops);

            draft.latent = {
                emb,
                coords: coordsRescale(
                    emb2d,
                    draft.spec.latent.width,
                    draft.spec.latent.height,
                    draft.spec.coordRescaleMargin
                ),
                qt: new Quadtree({
                    x: 0,
                    y: 0,
                    width: draft.spec.latent.width,
                    height: draft.spec.latent.height,
                }),
            };
            // Build quadtree for the embedding 2D coordinates
            for (let i = 0; i < draft.latent.coords.length; i++) {
                const c = draft.latent.coords[i];
                draft.latent.qt.insert({ id: i, x: c.x - 0.5, y: c.y - 0.5, width: 1, height: 1 });
            }
            draft.latent.posColor = draft.latent.coords.map((c) =>
                getNodeEmbeddingColor(c.x / draft.spec.latent.width, c.y / draft.spec.latent.height)
            );

            draft.attrMeta = attrs;
            draft.nodeAttrs = summarizeNodeAttrs(graph.nodes, attrs, draft.graph.nodeTypes);
            setNodeColors(draft, draft.param.colorBy);

            draft.isNodeSelected = new Array(graph.nodes.length).fill(false);
            return;

        case ACTION_TYPES.COMPUTE_DISTANCES_DONE:
            console.log("Data recieved.  Processing...", new Date());
            draft.distances.isComputing = false;
            let procDistData = processDistCompResults(action.distData, draft.graph.nodes.length);
            // for performance: avoid immer to do stuff recursively in these objects
            freeze(procDistData.distMatTopo);
            freeze(procDistData.distMatLatent);
            Object.assign(draft.distances, procDistData);
            draft.distances.display = [
                procDistData.scatterHistAll,
                computeScatterHistData(
                    draft.distances,
                    "edge",
                    draft.graph.edges,
                    draft.spec.scatterHist.numBins
                ),
            ];

            // Check whether there are focal groups during the distance computation.
            // if (draft.selectedNodes.length > 0) {
            //     draft.focalDistances = computeDistancesFocal(
            //         draft.selectedNodes,
            //         draft.latent.distMatrix,
            //         draft.latent.binGen
            //     );
            // }
            console.log("Distance Data processed", new Date());
            return;

        case ACTION_TYPES.HIGHLIGHT_NODES:
            draft.highlightedNodes = action.nodeIndices;
            draft.param.nodeFilter = {};
            switch (action.fromView) {
                case "node-attr":
                    draft.param.nodeFilter.whichAttr = action.which;
                    draft.param.nodeFilter.brushedArea = action.brushedArea;
                // No break here
                case "emb":
                case "focal-layout":
                case "graph-edge":
                    draft.highlightedNodes = action.nodeIndices;
                    draft.highlightedEdges = getEdgesWithinGroup(
                        draft.graph.edgeDict,
                        draft.highlightedNodes,
                        null
                    );
                    break;
                case "graph-node":
                    // Highlight their neighbors as well
                    neiRes = getNeighbors(
                        draft.graph.neighborMasksByHop,
                        draft.param.hopsHighlight,
                        draft.graph.edgeDict,
                        action.nodeIndices,
                        true
                    );
                    draft.highlightedNodes = neiRes.nodes;
                    draft.highlightedEdges = neiRes.edges;
                    break;
                case "node-type":
                    draft.highlightedNodes = [];
                    for (let n of draft.graph.nodes) {
                        if (n.typeId === action.which) {
                            draft.highlightedNodes.push(n.id);
                        }
                    }
                    draft.highlightedEdges = getEdgesWithinGroup(
                        draft.graph.edgeDict,
                        draft.highlightedNodes,
                        null
                    );
                    break;
                default:
            }

            if (
                action.fromView === null &&
                (action.nodeIndices === null || action.nodeIndices.length === 0)
            ) {
                draft.highlightedNodes = [];
                draft.highlightedEdges = [];
            }
            return;
        case ACTION_TYPES.HIGHLIGHT_NODE_PAIRS:
            const { brushedArea, which, brushedPairs } = action;
            draft.param.nodePairFilter.brushedArea = brushedArea;
            draft.param.nodePairFilter.which = which;
            if (which === null) {
                draft.highlightedNodePairs = [];
            } else {
                draft.highlightedNodePairs = brushedPairs.sort(
                    draft.param.nodePairFilter.ascending ? ascFunc : descFunc
                );
            }
            return;
        case ACTION_TYPES.HOVER_NODE:
            if (action.nodeIdx === null) {
                draft.hoveredNodes = [];
                draft.hoveredNeighbors = [];
                draft.hoveredEdges = [];
            } else if (Number.isInteger(action.nodeIdx)) {
                // Hover on a node
                draft.hoveredNodes = [action.nodeIdx];
                neiRes = getNeighbors(
                    draft.graph.neighborMasksByHop,
                    draft.param.hopsHighlight,
                    draft.graph.edgeDict,
                    draft.hoveredNodes,
                    true
                );
                draft.hoveredNeighbors = neiRes.nodes;
                draft.hoveredEdges = neiRes.edges;
            } else {
                // Hover on a node pair or edge
                draft.hoveredNodes = action.nodeIdx;
                draft.hoveredNeighbors = action.nodeIdx;
                draft.hoverEdges = getEdgesWithinGroup(draft.graph.edgeDict, draft.hoveredNodes, null);
            }
            return;
        case ACTION_TYPES.SELECT_NODES_PENDING:
            let { newSel, neighRes } = action;
            draft.selectedNodes = newSel;
            draft.distances.display.length = 2;
            if (newSel.length == 0) {
                // Clear selection
                draft.neighArr = null;
                draft.neighMap = null;
                draft.isNodeSelected = {};
                draft.isNodeSelectedNeighbor = {};
                draft.neighGrp = null;
                draft.selNodeAttrs = [];
                draft.selFeatures = [];
                draft.focalLayout = { running: false };
                draft.selBoundingBox = [];
            } else {
                draft.isNodeSelected = neighRes.isNodeSelected;
                draft.isNodeSelectedNeighbor = neighRes.isNodeSelectedNeighbor;
                draft.neighMap = neighRes.neighMap;
                draft.neighArr = neighRes.neighArr;
                // neighGrp is for the roll-up matrix of neighbor counts
                draft.neighGrp = countSelectedNeighborsByHop(
                    draft.graph.neighborMasksByHop,
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
                draft.focalLayout.running = true;
                draft.selBoundingBox = newSel.map((s) => computeBoundingBox(draft.latent.coords, s));

                // Compute the features for the focal nodes
                if (draft.featureAgg.cnts) {
                    draft.selFeatures = newSel.map((s) => {
                        const cnts = aggregateBinaryFeatures(draft.graph.features, s);
                        const maxCnts = max(cnts);
                        const compressedCnts = compressFeatureValues(cnts, draft.spec.feature.maxNumBars);
                        const scale = scaleSequential(interpolateGreys).domain([0, maxCnts]);
                        return { mode: "highlight", cnts, compressedCnts, maxCnts, scale };
                    });
                    if (newSel.length == 2) {
                        // Compute the diff feature data
                        const diffCnts = draft.selFeatures[0].cnts.map(
                            (c1, i) => c1 - draft.selFeatures[1].cnts[i]
                        );
                        const diffExtent = extent(diffCnts);
                        const t = Math.max(Math.abs(diffExtent[0]), Math.abs(diffExtent[1]));
                        const diffCompressedCnts = compressFeatureValues(
                            diffCnts,
                            draft.spec.feature.maxNumBars
                        );
                        draft.selFeatures.push({
                            mode: "diff",
                            cnts: diffCnts,
                            compressedCnts: diffCompressedCnts,
                            scale: scaleSequential(interpolateRdBu).domain([-t, t]),
                        });
                    }
                }

                // Compute distance distributions in latent space for focal nodes
                if (newSel[0].length > 1) {
                    draft.distances.display.push(
                        computeScatterHistData(
                            draft.distances,
                            "foc-0",
                            newSel[0],
                            draft.spec.scatterHist.numBins
                        )
                    );
                }
                if (newSel.length > 1 && newSel[1].length > 1) {
                    draft.distances.display.push(
                        computeScatterHistData(
                            draft.distances,
                            "foc-1",
                            newSel[1],
                            draft.spec.scatterHist.numBins
                        )
                    );
                    draft.distances.display.push(
                        computeScatterHistData(
                            draft.distances,
                            "between",
                            newSel,
                            draft.spec.scatterHist.numBins
                        )
                    );
                }
            }
            draft.param.features.collapsedSel = new Array(newSel.length + 1).fill(true);

            // Clear the highlight (blinking) nodes
            draft.param.nodeFilter = {};
            draft.highlightedNodes = [];

            // draft.latent.distToCurFoc = computeDistanceToCurrentFocus(
            //     draft.latent.distMatrix,
            //     draft.selectedNodes
            // );

            return;
        case ACTION_TYPES.SELECT_NODES_DONE:
            draft.focalLayout = {
                ...action.layoutRes,
                running: false,
            };
            if (action.layoutRes.coords) {
                draft.focalLayout.qt = new Quadtree({
                    x: 0,
                    y: 0,
                    width: action.layoutRes.width,
                    height: action.layoutRes.height,
                });
                for (let i = 0; i < action.layoutRes.coords.length; i++) {
                    const c = action.layoutRes.coords[i];
                    draft.focalLayout.qt.insert({
                        id: i,
                        x: c.x - 0.5,
                        y: c.y - 0.5,
                        width: 1,
                        height: 1,
                    });
                }
            }
            return;
        case ACTION_TYPES.CHANGE_PARAM:
            const paramPath = action.param.split(".");
            const lastParam = paramPath[paramPath.length - 1];
            let cur = draft.param;
            for (let i = 0; i < paramPath.length - 1; i++) {
                cur = cur[paramPath[i]];
            }
            if (action.inverse) {
                if (action.arrayIdx !== null) {
                    cur[lastParam][action.arrayIdx] = !cur[lastParam][action.arrayIdx];
                } else {
                    cur[lastParam] = !cur[lastParam];
                }
            } else {
                if (action.arrayIdx !== null) {
                    cur[lastParam][action.arrayIdx] = action.value;
                } else {
                    cur[lastParam] = action.value;
                }
            }

            // Special param changes
            if (action.param === "colorBy") {
                setNodeColors(draft, action.value);
            } else if (action.param === "nodePairFilter.ascending") {
                draft.highlightedNodePairs.sort(action.value ? ascFunc : descFunc);
            }
            return;
        case ACTION_TYPES.CHANGE_HOPS:
            if (draft.param.hops !== action.hops) {
                draft.param.hops = action.hops;
                // Re-calculate the neighbor masks
                // draft.graph.neighborMasksByHop = getNeighborMasksByHop(
                //     draft.graph.nodes,
                //     draft.graph.edges,
                //     draft.param.hops
                // );
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
                draft.focalLayout = {};
            }
            return;
        case ACTION_TYPES.LAYOUT_TICK:
            // Note that in D3, the tick function returns the simulation object itself
            // In web-cola, the tick function returns whether the simulation has converged
            if (draft.focalLayout && draft.focalLayout.simulation) {
                const converged = draft.focalLayout.simulation.tick();
                draft.focalLayout.coords = draft.focalLayout.simulation.nodes().map((d) => ({
                    x: d.x,
                    y: d.y,
                    g: d.group,
                }));
                if (draft.param.focalGraph.layout === "group-constraint-cola") {
                    // This is only a dirty way for quick check
                    draft.focalLayout.groups = draft.focalLayout.simulation._groups.map((g) => ({
                        id: g.id,
                        bounds: g.bounds,
                    }));
                    if (converged || draft.focalLayout.simulationTickNumber > 20) {
                        // if (converged) {
                        draft.focalLayout.running = false;
                    }
                } else {
                    if (draft.focalLayout.simulationTickNumber === 50) {
                        draft.focalLayout.running = false;
                    }
                }
                draft.focalLayout.simulationTickNumber += 1;
            }
            return;

        case ACTION_TYPES.CHANGE_EDGE_TYPE_STATE:
            draft.edgeAttributes.type.show[action.idx] = !draft.edgeAttributes.type.show[action.idx];
            return;

        case ACTION_TYPES.SEARCH_NODES:
            // Remove other node filters, e.g. node attributes
            draft.param.nodeFilter = { searchLabel: action.label, searchId: action.nodeIdx };
            if (action.label) {
                const l = action.label.toLowerCase();
                draft.highlightedNodes = draft.graph.nodes
                    .filter((n) => n.label && n.label.toString().toLowerCase().includes(l))
                    .map((n) => n.id);
            } else if (
                action.nodeIdx !== null &&
                0 <= action.nodeIdx &&
                action.nodeIdx < draft.graph.nodes.length
            ) {
                draft.highlightedNodes = [action.nodeIdx];
            } else {
                draft.highlightedNodes = [];
            }
            return;

        default:
            return;
    }
}, initialState);

export default reducers;
