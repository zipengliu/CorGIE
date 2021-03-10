import * as Comlink from "comlink";
import { bin as d3bin } from "d3";
import bs from "bitset";
import { getNeighborDistance, getCosineDistance, rectBinning } from "./utils";

// Store some big objects in the worker thread to avoid data transmission
let state = {
    emb: null,
    numNodes: null,
    edges: null,
    neighborMasks: null,
    distMetric: null,
    numBins: null,
    distMatLatent: null,
    distMatTopo: null,
};

function initializeState(emb, numNodes, edges, neighborMasks, distMetric, numBins) {
    state.emb = emb;
    state.numNodes = numNodes;
    state.edges = edges;
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

function computeDistances(mode, targetNodes = null, maxNumPairs = 0, targetPairs = null) {
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
        numPairs = state.edges.length;
        pairGen = function* () {
            for (let e of state.edges) {
                yield [e.source, e.target];
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
    } else if (mode === "special") {
        numPairs = targetPairs.length;
        pairGen = function* () {
            for (let p of targetPairs) {
                yield p;
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

    let k = 0;
    // let pairIter = pairGen();
    // let iterRes = pairIter.next();
    // while (!iterRes.done) {
    //     const s = iterRes.value[0],
    //         t = iterRes.value[1];
    //     computeDist(s, t, k);
    //     k++;
    //     iterRes = pairIter.next();
    // }
    for (const p of pairGen()) {
        computeDist(p[0], p[1], k);
        k++;
    }
    console.log("Binning distances...", new Date());

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
});
