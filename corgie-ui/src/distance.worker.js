import * as Comlink from "comlink";
import { extent, forceSimulation, forceManyBody, forceLink, forceX, forceY, bin as d3bin } from "d3";
import { Layout as cola } from "webcola";
import { UMAP } from "umap-js";
import bs from "bitset";
import { getNeighborDistance, getCosineDistance, rectBinning } from "./utils";

// Store some big objects in the worker thread to avoid data transmission
let state = {
    emb: null,
    numNodes: null,
    edgeSrc: null,
    edgeTgt: null,
    neighborMasks: null,
    distMetric: null,
    numBins: null,
    distMatLatent: null,
    distMatTopo: null,
};

// The bitset class functions are not copied from the main thread,
// so we need to re-construct the bitsets in-place
function reconstructBitsets(neighMap) {
    for (let id in neighMap)
        if (neighMap.hasOwnProperty(id)) {
            neighMap[id] = bs(neighMap[id]);
        }
}

function getCanvasSize(n) {
    return Math.ceil(Math.sqrt(n * 500));
}

export function computeLocalLayoutWithUMAP(
    nodes,
    hops,
    selectedNodes,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighArr,
    neighMap, // node connection signature: either global or local
    distMetric,
    spec
) {
    const runUMAP = (nodeIdxArr) => {
        if (nodeIdxArr.length < 15) {
            // Not enough data to compute UMAP
            return nodeIdxArr.map((_) => [Math.random(), Math.random()]);
        } else {
            console.log("Calling UMAP: ", nodeIdxArr.length);
            const distFunc = (x, y) => getNeighborDistance(neighMap[x], neighMap[y], distMetric); // Global signature
            // const distFunc = (x, y) => getNeighborDistance(neighMap[x[0]], neighMap[y[0]], distMetric); // Global signature
            // getNeighborDistance(neighMap[x[0]], neighMap[y[0]], distMetric);   // Local signature
            const sim = new UMAP({ distanceFn: distFunc });
            // const trickyArr = nodeIdxArr.map((x) => [x]);
            return sim.fit(nodeIdxArr);
        }
    };

    console.log("Computing local layout with UMAP...");
    reconstructBitsets(neighMap);
    const n = nodes.length;
    const n1a = selectedNodes[0].length,
        n1b = selectedNodes.length > 1 ? selectedNodes[1].length : 0,
        n2 = neighArr[0].length,
        n3 = neighArr[1].length,
        n4 = n - n1a - n1b - n2 - n3;
    let nodesByHop = [selectedNodes];
    for (let i = 0; i < hops; i++) {
        nodesByHop.push(neighArr[i]);
    }
    let others = [];
    for (let nodeId = 0; nodeId < n; nodeId++)
        if (!isNodeSelected[nodeId] && !isNodeSelectedNeighbor[nodeId]) {
            others.push(nodeId);
        }
    nodesByHop.push(others);

    let embeddings = [[runUMAP(selectedNodes[0])]];
    if (selectedNodes.length > 1) {
        embeddings[0].push(runUMAP(selectedNodes[1]));
    }
    for (let i = 1; i < nodesByHop.length; i++) {
        embeddings.push(runUMAP(nodesByHop[i]));
    }
    console.log({ embeddings });

    // Embeddings of other nodes

    const canvasSize = getCanvasSize(nodes.length);
    // Resize the embeddings for the four different groups of nodes: selected, 1-hop, 2-hop, others
    const weights = [4, 6, 4, 1];
    const weightedSum = (n1a + n1b) * weights[0] + n2 * weights[1] + n3 * weights[2] + n4 * weights[3];
    // const weightedN = n1a + n1b + n2 + n3 + n4;
    const nums = [n1a + n1b, n2, n3, n4];
    const coords = new Array(n);
    const gap = 30;
    const selectedNodesSep = 40;
    let groups = [];
    let yOffset = 0;
    const marginLR = 8;

    // Rescale the UMAP embeddings to a width x height rectangular space
    let rescale = (nodes, emb, width, height, xOffset, yOffset) => {
        let xExtent, yExtent, xRange, yRange;

        xExtent = extent(emb.map((e) => e[0]));
        yExtent = extent(emb.map((e) => e[1]));
        xRange = xExtent[1] - xExtent[0];
        yRange = yExtent[1] - yExtent[0];
        // console.log({ nodes: nodes.slice(), xExtent, yExtent });
        if (xRange < Number.EPSILON) {
            xRange = 1;
        }
        if (yRange < Number.EPSILON) {
            yRange = 1;
        }
        if (nodes.length === 1) {
            // Only one node, place it in the middle
            coords[nodes[0]] = { x: xOffset + width / 2, y: yOffset + height / 2 };
        } else {
            for (let j = 0; j < nodes.length; j++) {
                const nodeId = nodes[j];
                coords[nodeId] = {
                    x: xOffset + ((emb[j][0] - xExtent[0]) * (width - marginLR)) / xRange + marginLR / 2,
                    y: yOffset + ((emb[j][1] - yExtent[0]) * height) / yRange,
                };
            }
        }
    };

    for (let i = 0; i < 4; i++) {
        // The allocated height for this group of nodes
        let height = ((canvasSize - 3 * gap) / weightedSum) * nums[i] * weights[i],
            width = canvasSize;
        const b = {
            x: 0,
            y: yOffset - gap / 3,
            width: canvasSize,
            height: height + (gap / 3) * 2,
        };
        if (i == 0 && selectedNodes.length > 1) {
            // Seperate the two selected groups
            width = (canvasSize - selectedNodesSep) / 2;
            groups.push({ bounds: { ...b, width } });
            groups.push({ bounds: { ...b, x: width + selectedNodesSep, width } });
        } else {
            groups.push({ bounds: b });
        }
        if (i == 0) {
            rescale(selectedNodes[0], embeddings[0][0], width, height, 0, yOffset);
            if (selectedNodes.length > 1) {
                rescale(selectedNodes[1], embeddings[0][1], width, height, width + selectedNodesSep, yOffset);
            }
        } else {
            rescale(nodesByHop[i], embeddings[i], width, height, 0, yOffset);
        }
        yOffset += height + gap;
    }
    console.log("UMAP layout computed!");
    console.log({ groups, coords });

    return {
        coords,
        groups,
        width: canvasSize,
        height: canvasSize,
        // simulation,
        // simulationTickNumber: 10,
        running: false,
    };
}

export function computeLocalLayoutWithCola(
    nodes,
    edges,
    hops,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighGrp,
    neighMap,
    distMetric,
    spec
) {
    reconstructBitsets(neighMap);
    // Construct group info for webcola
    let coords = nodes.map((n, i) => ({
        index: i,
        // temporily assign group hops+1 to all other nodes
        width: (n.typeId === 0 ? spec.centralNodeSize : spec.auxNodeSize) * 3,
        height: (n.typeId === 0 ? spec.centralNodeSize : spec.auxNodeSize) * 3,
        group: isNodeSelected[i] ? 0 : isNodeSelectedNeighbor[i] ? isNodeSelectedNeighbor[i] : hops + 1,
    }));

    let groups = [];
    // let n = 0;
    for (let h = 0; h <= hops + 1; h++) {
        groups.push({ id: h, leaves: [], padding: 5 });
    }
    groups[1].groups = [];
    for (let g of neighGrp[0]) {
        const curGrp = { id: groups.length, leaves: [], groups: [], padding: 3 };
        groups[1].groups.push(curGrp.id);
        groups.push(curGrp);
        for (let g2 of g.subgroups) {
            const curGrp2 = { id: groups.length, leaves: g2.slice(), padding: 2 };
            groups.push(curGrp2);
            curGrp.groups.push(curGrp2.id);
        }
    }
    for (let i = 0; i < coords.length; i++) {
        if (coords[i].group !== 1) {
            groups[coords[i].group].leaves.push(i);
        }
    }
    console.log(groups);

    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 3000));

    const constraints = [];
    for (let grp of neighGrp[0]) {
        for (let nodeA of grp.nodes) {
            // 1-hop neighbors are below selected nodes
            for (let nodeB of groups[0].leaves) {
                constraints.push({ axis: "y", left: nodeB, right: nodeA, gap: 40 });
            }
            // 1-hop neighbors are above 2-hop neighbors and others
            for (let nodeB of groups[2].leaves) {
                constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
            }
        }
    }
    // 2-hop neighbors are above others
    for (let nodeA of groups[2].leaves) {
        for (let nodeB of groups[3].leaves) {
            constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
        }
    }
    // Order the groups in 1-hop neighbors from left to right
    for (let i = 0; i < neighGrp[0].length - 1; i++) {
        for (let nodeA of neighGrp[0][i].nodes) {
            for (let nodeB of neighGrp[0][i + 1].nodes) {
                constraints.push({ axis: "x", left: nodeA, right: nodeB, gap: 25 });
            }
        }
    }
    // console.log("layout constraints: ", constraints);

    // Copy edges to prevent contanimation
    const copiedEdges = edges.map((e) => ({ ...e }));

    let simulation = new cola()
        .size([canvasSize, canvasSize])
        .nodes(coords)
        .links(copiedEdges)
        .groups(groups)
        .defaultNodeSize(3)
        .avoidOverlaps(true)
        .constraints(constraints)
        // .linkDistance(15)
        .linkDistance((e) => {
            if (neighMap.hasOwnProperty(e.source) && neighMap.hasOwnProperty(e.target)) {
                return 20 * getNeighborDistance(neighMap[e.source], neighMap[e.target], distMetric);
            } else {
                return 15;
            }
        })
        // .symmetricDiffLinkLengths(2, 1)
        // .jaccardLinkLengths(5, 1)
        .convergenceThreshold(10)
        .start(10, 15, 10, 0, false);

    // let iter = 0;
    // while (!simulation.tick()) {
    //     iter++;
    // }
    // console.log({iter});

    // for (let i = 0; i < 0; i++) {
    //     simulation.tick();
    // }
    // console.log(coords);

    // simulation.constraints([]);

    return {
        coords: coords.map((d) => ({ x: d.x, y: d.y, g: d.group })),
        groups: groups.map((g) => ({ id: g.id, bounds: g.bounds })),
        width: canvasSize,
        height: canvasSize,
        simulation,
        simulationTickNumber: 10,
        running: true,
    };
}

export function computeLocalLayoutWithD3(
    nodes,
    edges,
    hops,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighMap,
    distMetric,
    spec
) {
    reconstructBitsets(neighMap);
    const getHopGroup = (i) =>
        isNodeSelected[i] ? 0 : isNodeSelectedNeighbor[i] ? isNodeSelectedNeighbor[i] : hops + 1;
    let coords = nodes.map((n, i) => ({ index: i, group: getHopGroup(i) }));
    const copiedEdges = edges.map((e) => ({ ...e }));

    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 1000));

    const groupCounts = [0, 0, 0, 0];
    for (let c of coords) {
        groupCounts[c.group]++;
    }
    let curTot = 0,
        groupPos = [];
    for (let g of groupCounts) {
        groupPos.push(((curTot + g / 2) / nodes.length) * canvasSize);
        curTot += g;
    }
    console.log({ groupCounts, groupPos });

    // Construct virtual links for group of neighbor nodes using Hamming distance
    const groupLinks = [];
    for (let neighId1 in neighMap)
        if (neighMap.hasOwnProperty(neighId1)) {
            for (let neighId2 in neighMap)
                if (neighId1 !== neighId2 && neighMap.hasOwnProperty(neighId2)) {
                    groupLinks.push({
                        source: parseInt(neighId1),
                        target: parseInt(neighId2),
                        dist: getNeighborDistance(neighMap[neighId1], neighMap[neighId2], distMetric) + 1,
                    });
                }
        }
    console.log(groupLinks);
    const n = Object.keys(neighMap).length;

    let simulation = forceSimulation(coords)
        .force("link", forceLink(copiedEdges))
        .force(
            "neighGroup",
            forceLink(groupLinks)
                .distance((d) => d.dist * 20)
                .strength(10 / n)
        )
        .force("charge", forceManyBody().strength(-40))
        .force("centerX", forceX(canvasSize / 2).strength(0.2))
        .force("centerY", forceY(canvasSize / 2).strength(0.1))
        .force(
            "hopGroup",
            forceY()
                .y((d) => groupPos[d.group])
                .strength(0.4)
        )
        .stop();
    // simulation.tick(300);

    return {
        coords: coords.map((d) => ({ x: d.x, y: d.y })),
        // groups: groups.map((g) => ({ id: g.id, bounds: g.bounds })),
        width: canvasSize,
        height: canvasSize,
        simulation,
        simulationTickNumber: 0,
        running: true,
    };
}

export function computeSpaceFillingCurveLayout(
    nodes,
    hops,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighArr,
    neighMap,
    distMetric
) {
    reconstructBitsets(neighMap);
    const n = nodes.length;
    const orderedNodes = [];
    for (let nodeId in isNodeSelected)
        if (isNodeSelected[nodeId]) {
            orderedNodes.push(nodeId);
        }
    for (let a of neighArr) {
        for (let neighId of a) {
            orderedNodes.push(neighId);
        }
    }
    for (let i = 0; i < n; i++)
        if (!isNodeSelected[i] && !isNodeSelectedNeighbor[i]) {
            orderedNodes.push(i);
        }
    console.log({ orderedNodes });

    const alpha = 2;
    let curPos = 1;
    const coords = new Array(n);
    for (let i = 0; i < n; i++) {
        let d = 1.2;
        if (
            i > 0 &&
            neighMap.hasOwnProperty(orderedNodes[i]) &&
            neighMap.hasOwnProperty(orderedNodes[i - 1])
        ) {
            d = getNeighborDistance(neighMap[orderedNodes[i]], neighMap[orderedNodes[i - 1]], distMetric);
            d = Math.max(d, 0.1);
        }
        curPos += d;

        const r = alpha * curPos;
        coords[orderedNodes[i]] = [r * Math.cos(curPos), r * Math.sin(curPos)];
    }
    console.log(coords);

    // Move the coordinates such that (0,0) is on the top left for rendering
    const xExtent = extent(coords.map((c) => c[0]));
    const yExtent = extent(coords.map((c) => c[1]));
    const width = xExtent[1] - xExtent[0];
    const height = yExtent[1] - yExtent[0];
    const transCoords = coords.map((c) => ({ x: c[0] - xExtent[0], y: c[1] - yExtent[0] }));
    console.log({ transCoords });

    return { coords: transCoords, running: false, width, height };
}

function initializeState(emb, numNodes, edgeSrc, edgeTgt, neighborMasks, distMetric, numBins) {
    state.emb = emb;
    state.numNodes = numNodes;
    state.edgeSrc = edgeSrc;
    state.edgeTgt = edgeTgt;
    state.neighborMasks = neighborMasks.map((m) => bs(m));
    state.distMetric = distMetric;
    state.numBins = numBins;

    function initDistMat(n) {
        let d = {};
        for (let i = 0; i < n; i++) {
            d[i] = { [i]: 0 };
        }
        return d;
    }
    state.distMatLatent = initDistMat(numNodes);
    state.distMatTopo = initDistMat(numNodes);
}

// const computeScatterHistData = (distData, whichSubset, ref, numBins) => {
//     const { distMatTopo, distMatLatent, binGen } = distData;
//     let data = {
//         name: whichSubset,
//         dist: [],
//         src: [],
//         tgt: [],
//         binsLatent: null,
//         binsTopo: null,
//     };
//     let binRes;

//     function checkAndCompute(s, t) {
//         // Must check whether we have computed that value
//         if (distMatLatent[s].hasOwnProperty(t)) {
//             data.dist.push([distMatLatent[s][t], distMatTopo[s][t]]);
//             data.src.push(s);
//             data.tgt.push(t);
//         }
//     }

//     if (whichSubset === "edge") {
//         // Ref should be edges
//         for (let e of ref) {
//             checkAndCompute(e.source, e.target);
//         }
//         data.title = "those connected by edges";
//     } else if (whichSubset.includes("between")) {
//         for (let i = 0; i < ref[0].length; i++) {
//             for (let j = 0; j < ref[1].length; j++) {
//                 checkAndCompute(ref[0][i], ref[1][j]);
//             }
//         }
//         data.title = "those between foc-0 and foc-1";
//     } else if (whichSubset.includes("foc")) {
//         for (let i = 0; i < ref.length; i++) {
//             for (let j = i + 1; j < ref.length; j++) {
//                 checkAndCompute(ref[i], ref[j]);
//             }
//         }
//         data.title = `those within ${whichSubset}`;
//     }
//     binRes = rectBinning(data.dist, [1, 1], numBins);
//     Object.assign(data, {
//         binsLatent: binGen(data.dist.map((x) => x[0])),
//         binsTopo: binGen(data.dist.map((x) => x[1])),
//         gridBins: binRes.bins,
//         gridBinsMaxCnt: binRes.maxCnt,
//     });
//     console.log(data);
//     return data;
// };

function computeDistances(mode, targetNodes = null, maxNumPairs = 0) {
    console.log("Computing distances ...", new Date());

    const n = state.numNodes;
    const { distMatLatent, distMatTopo, emb, neighborMasks } = state;

    let numPairs, pairGen;
    if (mode === "all") {
        numPairs = (n * (n - 1)) / 2;
        pairGen = function* () {
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    yield [i, j];
                }
            }
        };
    } else if (mode === "sample") {
        numPairs = Math.min((n * (n - 1)) / 2, maxNumPairs);
        pairGen = function* () {
            const dup = {};
            // sample node pairs
            const maxSeqNum = n * (n - 1);
            let x;
            for (let i = 0; i < numPairs; i++) {
                do {
                    x = Math.floor(Math.random() * maxSeqNum);
                } while (dup[x]);
                dup[x] = true;
                let s = Math.floor(x / (n - 1)),
                    t = x % (n - 1);
                if (t >= s) {
                    t++;
                }
                yield [s, t];
            }
        };
    } else if (mode === "edge") {
        numPairs = state.edgeSrc.length;
        pairGen = function* () {
            for (let i = 0; i < numPairs; i++) {
                yield [state.edgeSrc[i], state.edgeTgt[i]];
            }
        };
    } else if (mode === "within") {
        numPairs = (targetNodes.length * (targetNodes.length - 1)) / 2;
        pairGen = function* () {
            for (let i = 0; i < targetNodes.length; i++) {
                for (let j = i + 1; j < targetNodes.length; j++) {
                    yield [targetNodes[i], targetNodes[j]];
                }
            }
        };
    } else if (mode === "between") {
        numPairs = targetNodes[0].length * targetNodes[1].length;
        pairGen = function* () {
            for (let i = 0; i < targetNodes[0].length; i++) {
                for (let j = 0; j < targetNodes[1].length; j++) {
                    yield [targetNodes[0][i], targetNodes[1][j]];
                }
            }
        };
    }

    const srcArrayBuffer = new ArrayBuffer(numPairs * 2),
        srcBuf = new Uint16Array(srcArrayBuffer),
        tgtArrayBuffer = new ArrayBuffer(numPairs * 2),
        tgtBuf = new Uint16Array(tgtArrayBuffer);
    const dist = [],
        distLatent = [],
        distTopo = [];

    function computeDist(i, j, k) {
        let dLat, dTopo;
        if (distMatLatent[i].hasOwnProperty(j)) {
            dLat = distMatLatent[i][j];
            dTopo = distMatTopo[i][j];
        } else {
            dLat = getCosineDistance(emb[i], emb[j]);
            dTopo = getNeighborDistance(neighborMasks[i], neighborMasks[j], state.distMetric);
            distMatLatent[i][j] = dLat;
            distMatLatent[j][i] = dLat;
            distMatTopo[i][j] = dTopo;
            distMatTopo[j][i] = dTopo;
        }
        distLatent.push(dLat);
        distTopo.push(dTopo);
        dist.push([dLat, dTopo]);
        srcBuf[k] = i;
        tgtBuf[k] = j;
    }

    let pairIter = pairGen();
    let iterRes = pairIter.next();
    let k = 0;
    while (!iterRes.done) {
        const s = iterRes.value[0],
            t = iterRes.value[1];
        computeDist(s, t, k);
        k++;
        iterRes = pairIter.next();
    }

    const binGen1d = d3bin().domain([0, 1]).thresholds(state.numBins);
    const binsLatent = binGen1d(distLatent),
        binsTopo = binGen1d(distTopo);
    const gridRes = rectBinning(dist, [1, 1], state.numBins);

    console.log("Finish computing distances!", new Date());
    return Comlink.transfer(
        {
            src: srcBuf,
            tgt: tgtBuf,
            binsLatent,
            binsTopo,
            gridBins: gridRes.bins,
            gridBinsMaxCnt: gridRes.maxCnt,
        },
        [srcBuf.buffer, tgtBuf.buffer]
    );
}

Comlink.expose({
    initializeState: initializeState,
    computeDistances: computeDistances,
    computeLocalLayoutWithCola: computeLocalLayoutWithCola,
    computeLocalLayoutWithD3: computeLocalLayoutWithD3,
    computeLocalLayoutWithUMAP: computeLocalLayoutWithUMAP,
    computeSpaceFillingCurveLayout: computeSpaceFillingCurveLayout,
});
