// Pre-process a dataset for the CorGIE frontend
//      * Filter self-loop and duplicate edges
//      * Compute a dictionary for edge sources and targets (fast indices to find edges)
//      * Compute neighbor masks for each node using bitsets
//      * Compute intial D3 force-directed layout
//      * Compute the distances in latent, topo, and distance space.
//      * Perform UMAP on node embeddings (if not yet)
//      * Perform force-directed edge bundling on edges of UMAP
//      * Perform neighbor binning in latent space
//
// Required input files:
//      * graph.json:  node and edge data in NetworkX format
//      * datasets.json:  a meta data file in the UI source.  We will use the "hops" field here.  TODO consider a better way
//      * node-embeddings.csv: each row is the embedding vector for a node
// Optional input files:
//      * attr-meta.json: metadata for the dense features that are stored in graph.json
//      * features.csv: sparse features matrix
//      * umap.csv: 2D UMAP result of node embeddings
//
// Output files:
//      * graph.json: sanitized graph, edge dictionary, neighbor masks
//      * initial-layout.json: D3 force-directed layout
//      * distances.json: distance values
//      * umap.json: 2D UMAP result of node embeddings, edge bundilng results, neighbor binning

const fs = require("fs");
const { readFile, writeFile } = require("fs/promises");
const bs = require("bitset");
const csvParser = require("csv-parser");
const neatCsv = require("neat-csv");
const UMAP = require("umap-js");
const seedrandom = require("seedrandom");
const forceBundling = require("./forceBundling");
const mingleBundling = require("../../src/mingleBundling");
const datasetsInfo = require("../../src/datasets.json");

const {
    forceSimulation,
    forceManyBody,
    forceLink,
    forceCenter,
    scaleSqrt,
    scaleLog,
    scaleLinear,
    scaleQuantize,
    extent,
    bin,
} = require("d3");

const BIN_GRANULARITY = 8;

const padding = 16;
function computeForceLayoutWithD3(numNodes, edges, padding, bounded) {
    // const constrainCoord = (v, min, max) => Math.max(min, Math.min(v, max));
    console.log("Computing initial D3 force layout...");
    const startTime = new Date();
    let coords = new Array(numNodes).fill(false).map((_, i) => ({ index: i }));
    const copiedEdges = edges.map((e) => ({ source: e.source, target: e.target }));

    const maxNumNodes = 10000;
    const getSize = scaleSqrt().domain([1, maxNumNodes]).range([500, 1000]).clamp(true),
        getLinkDistance = scaleLog().base(2).domain([1, maxNumNodes]).range([100, 1.5]).clamp(true),
        getRepelStrength = scaleLog().base(2).domain([1, maxNumNodes]).range([-100, -1.5]).clamp(true);
    const canvasSize = getSize(numNodes),
        linkDist = getLinkDistance(numNodes),
        repelStrength = getRepelStrength(numNodes);

    console.log("D3 parameters: ", { canvasSize, linkDist, repelStrength, padding });

    let simulation = forceSimulation(coords)
        .force("link", forceLink(copiedEdges).distance(linkDist))
        .force("charge", forceManyBody().strength(repelStrength).distanceMin(0.2).distanceMax(100))
        .force("center", forceCenter(canvasSize / 2, canvasSize / 2))
        .stop();

    const numIterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    if (bounded) {
        for (let i = 0; i < numIterations; i++) {
            // Constrain the nodes in a bounding box
            for (let c of coords) {
                c.x = Math.max(padding, Math.min(canvasSize - padding, c.x));
                c.y = Math.max(padding, Math.min(canvasSize - padding, c.y));
            }
            simulation.tick();
        }
    } else {
        simulation.tick(numIterations);
    }

    const xExtent = extent(coords.map((c) => c.x)),
        yExtent = extent(coords.map((c) => c.y));
    const xRange = xExtent[1] - xExtent[0],
        yRange = yExtent[1] - yExtent[0];
    let xScale = (x) => x,
        yScale = (y) => y;
    let width = canvasSize,
        height = canvasSize;
    if (!bounded || xRange + 2 * padding < canvasSize * 0.95) {
        xScale = scaleLinear()
            .domain(xExtent)
            .range([padding, xRange + padding]);
        width = xRange + 2 * padding;
    }
    if (!bounded || yRange + 2 * padding < canvasSize * 0.95) {
        yScale = scaleLinear()
            .domain(yExtent)
            .range([padding, yRange + padding]);
        height = yRange + 2 * padding;
    }
    const endTime = new Date();
    const totalTime = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log("Finish computing initial D3 force layout");
    console.log("Elapsed time: ", totalTime, " seconds");
    return {
        coords: coords.map((c) => ({ x: xScale(c.x), y: yScale(c.y) })),
        width,
        height,
        name: "D3 force-directed",
    };
}

// Filter edges: self loop and duplicates are removed.
// Note: we treat all edges as undirectional.
// Compute an edge dictionary by its source ID
function filterEdgeAndComputeDict(numNodes, edges) {
    const filteredEdges = [];

    const d = new Array(numNodes);
    const h = {};
    for (let i = 0; i < numNodes; i++) {
        d[i] = [];
        h[i] = {};
    }
    let k = 0;
    for (let e of edges) {
        if (e.source !== e.target) {
            // not self loops
            let s = Math.min(e.source, e.target),
                t = Math.max(e.source, e.target);
            if (!h[s].hasOwnProperty(t)) {
                // remove dup edges
                d[e.source].push({ nid: e.target, eid: k });
                d[e.target].push({ nid: e.source, eid: k });
                filteredEdges.push({ ...e, eid: k });
                k++;
            }
            h[s][t] = true;
        }
    }
    return { edges: filteredEdges, edgeDict: d };
}

// Comppute the neighborMasksByHop and neighborMasks (all hops combined)
function computeNeighborMasks(numNodes, edgeDict, hops) {
    const masks = [],
        masksByHop = [];
    let last;
    for (let i = 0; i < numNodes; i++) {
        masks.push(bs(0));
        // include self
        masks[i].set(i, 1);
    }

    // first hop
    for (let sid = 0; sid < edgeDict.length; sid++) {
        for (let targetNode of edgeDict[sid]) {
            const tid = targetNode.nid;
            masks[sid].set(tid, 1);
            masks[tid].set(sid, 1);
        }
    }
    masksByHop.push(masks.map((m) => m.clone()));
    last = masksByHop[0];

    // hop > 1
    for (let h = 1; h < hops; h++) {
        const cur = [];
        for (let i = 0; i < numNodes; i++) {
            cur.push(bs(0));
        }
        for (let i = 0; i < numNodes; i++) {
            let m = masks[i];
            for (let sid of m.toArray()) {
                for (let targetNode of edgeDict[sid]) {
                    m.set(targetNode.nid, 1);
                }
            }

            for (let sid of last[i].toArray()) {
                for (let targetNode of edgeDict[sid]) {
                    cur[i].set(targetNode.nid, 1);
                }
            }
        }
        masksByHop.push(cur);
        last = cur;
    }
    return { neighborMasks: masks, neighborMasksByHop: masksByHop };
}

function normalizeFeatures(attrMeta, nodes) {
    const scalingFuncs = [];
    for (let a of attrMeta) {
        const f = nodes.map((n) => Number(n[a.name]) || 0);
        const e = extent(f);
        scalingFuncs.push(scaleLinear().domain(e).range([0, 1]));
    }
    return nodes.map((n) =>
        attrMeta.map((a, i) => (n.hasOwnProperty(a.name) ? scalingFuncs[i](Number(n[a.name])) : 0))
    );
}

function getHops(id) {
    const defaultHops = 2;
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

function getNeighborDistance(mask1, mask2, metric) {
    if (metric === "hamming") {
        // Hamming distance
        return mask1.xor(mask2).cardinality();
    } else if (metric === "jaccard") {
        // Jaccard distance
        const intersection = mask1.and(mask2).cardinality();
        const union = mask1.or(mask2).cardinality();
        return union === 0 ? 0 : 1 - intersection / union;
    } else {
        return 0;
    }
}

const sim2dist = scaleLinear().domain([-1, 1]).range([1, 0]);
function getCosineDistance(u, v) {
    let p = 0,
        magU = 0,
        magV = 0;
    for (let i = 0; i < u.length; i++) {
        p += u[i] * v[i];
        magU += Math.pow(u[i], 2);
        magV += Math.pow(v[i], 2);
    }
    const mag = Math.sqrt(magU) * Math.sqrt(magV);
    const sim = p / mag;
    return sim2dist(sim);
}

function getEuclideanDistance(u, v) {
    let s = 0;
    for (let i = 0; i < u.length; i++) {
        s += Math.pow(u[i] - v[i], 2);
    }
    return Math.sqrt(s);
}

function rectBinning(dataX, dataY, extent, numBins) {
    const unitX = extent[0] / numBins,
        unitY = extent[1] / numBins;
    const bins = new Array(numBins);
    for (let i = 0; i < numBins; i++) {
        bins[i] = new Array(numBins).fill(0).map(() => []);
    }

    let m = 0;
    function inc(valX, valY, idx) {
        let i = Math.floor(valX / unitX),
            j = Math.floor(valY / unitY);
        i = Math.min(i, numBins - 1);
        j = Math.min(j, numBins - 1);
        bins[i][j].push(idx);
        m = Math.max(m, bins[i][j].length);
    }

    for (let i = 0; i < dataX.length; i += 1) {
        inc(dataX[i], dataY[i], i);
    }
    return { bins, maxCnt: m };
}

function getFeatureDistMax(n, features) {
    let s = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            dFeat = getEuclideanDistance(features[i], features[j]);
            distMatFeature[i][j] = dFeat;
            distMatFeature[j][i] = dFeat;
            s = Math.max(s, dFeat);
        }
    }
    const featScale = scaleLinear().domain([0, s]).range([0, 1]);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (distMatFeature[i].hasOwnProperty(j)) {
                distMatFeature[i][j] = featScale(distMatFeature[i][j]);
            }
        }
    }
    return s;
}

const maxNumPairs = 1000000;
function computeDistances(mode, n, types, edges, emb, neighborMasks, features, featureDistMax = null) {
    console.log("Computing distances ... ", mode);
    const startTime = new Date();

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
        numPairs = edges.length;
        pairGen = function* () {
            for (let e of edges) {
                yield [e.source, e.target];
            }
        };
    }

    const sources = new Array(numPairs),
        targets = new Array(numPairs);
    let dist = [],
        distLatent = [],
        distTopo = [],
        distFeature = [];

    function computeDist(i, j, k) {
        let dLat, dTopo, dFeat;
        if (distMatLatent[i].hasOwnProperty(j)) {
            dLat = distMatLatent[i][j];
            dTopo = distMatTopo[i][j];
            dFeat = features ? distMatFeature[i][j] : null;
        } else {
            dLat = getCosineDistance(emb[i], emb[j]);
            dTopo = getNeighborDistance(neighborMasks[i], neighborMasks[j], distMetric);
            dFeat = !features || types[i] !== types[j] ? 0 : distMatFeature[i][j];
            distMatLatent[i][j] = dLat;
            distMatLatent[j][i] = dLat;
            distMatTopo[i][j] = dTopo;
            distMatTopo[j][i] = dTopo;
        }
        distLatent.push(dLat);
        distTopo.push(dTopo);
        if (features) {
            distFeature.push(dFeat);
            dist.push([dLat, dTopo, dFeat]);
        } else {
            dist.push([dLat, dTopo]);
        }
        sources[k] = i;
        targets[k] = j;
    }

    let k = 0;
    for (const p of pairGen()) {
        computeDist(p[0], p[1], k);
        k++;
    }

    console.log("Binning distances...");
    const numBins = 20;
    const binGen1d = bin().domain([0, 1]).thresholds(numBins);
    const binsLatent = binGen1d(distLatent),
        binsTopo = binGen1d(distTopo);
    const gridsTopo = rectBinning(distLatent, distTopo, [1, 1], numBins);
    let binsFeature = null,
        gridsFeature = null;
    if (features) {
        console.assert(extent(distFeature)[1] <= 1.0);
        binsFeature = binGen1d(distFeature);
        gridsFeature = rectBinning(distLatent, distFeature, [1, 1], numBins);
    }

    const simplifyBinResult = (bins) => bins.map((b) => ({ x0: b.x0, x1: b.x1, length: b.length }));

    const endTime = new Date();
    console.log(
        "Finish computing distances.  total time: ",
        (endTime.getTime() - startTime.getTime()) / 1000,
        "s"
    );
    return {
        src: sources,
        tgt: targets,
        binsLatent: simplifyBinResult(binsLatent),
        binsTopo: simplifyBinResult(binsTopo),
        binsFeature: binsFeature ? simplifyBinResult(binsFeature) : null,
        gridsTopo,
        gridsFeature,
    };
}

function getUMAPresults(filepath, emb) {
    return readFile(filepath)
        .then(async (data) => {
            const d = await neatCsv(data, { headers: false });
            const n = Object.keys(d[0]).length;
            const res = [];
            for (let r of d) {
                let temp = [];
                for (let i = 0; i < n; i++) {
                    temp.push(Number(r[i]));
                }
                res.push(temp);
            }
            return res;
        })
        .catch(() => {
            // If UMAP result does not exist, compute here
            console.log("Computing UMAP...");
            const rng = seedrandom("hello.");
            const simulation = new UMAP.UMAP({ random: rng });
            return simulation.fit(emb);
        });
}

function performEdgeBundling(edges, coords, method = "force") {
    console.log("Edge bundling....");
    const startTime = new Date();

    const edgeCoords = new Array(edges.length);
    // enlarge the coords to avoid artefacts in edge bundling algorithm
    // const scaleX = scaleLinear()
    //         .domain(extent(coords.map((c) => c.x)))
    //         .range([0, 400]),
    //     scaleY = scaleLinear()
    //         .domain(extent(coords.map((c) => c.y)))
    //         .range([0, 400]);
    // coords = coords.map((c) => ({ x: scaleX(c.x), y: scaleY(c.y) }));
    if (method === "force") {
        const fbdl = forceBundling()
            .nodes(coords)
            .edges(edges)
            .subdivision_rate(1.05)
            .iterations(10)
            .iterations_rate(0.5);

        const bundleRes = fbdl();

        // Flatten the coordinates since the Konva library in CorGIE uses flatten coords
        for (let i = 0; i < edges.length; i++) {
            let flattenCoords = [];
            if (!bundleRes[i]) {
                // Happends sometimes when the two coords are too close
                const { source, target } = edges[i];
                console.log('edge bundling failed at ', i, coords[source], coords[target]);
                flattenCoords = [
                    coords[source].x.toFixed(3),
                    coords[source].y.toFixed(3),
                    coords[target].x.toFixed(3),
                    coords[target].y.toFixed(3),
                ];
            } else {
                for (let c of bundleRes[i]) {
                    flattenCoords.push(c.x.toFixed(3));
                    flattenCoords.push(c.y.toFixed(3));
                }
            }
            edgeCoords[i] = flattenCoords;
        }
    } else {
        // MINGLE bundling
        const delta = 0.8;
        const bundle = new mingleBundling({
            curviness: 1,
            angleStrength: 1,
        });
        const edgeData = edges.map((e, i) => ({
            id: i,
            name: i,
            data: {
                coords: [coords[e.source].x, coords[e.source].y, coords[e.target].x, coords[e.target].y],
            },
        }));
        bundle.setNodes(edgeData);
        bundle.buildNearestNeighborGraph(10);
        bundle.MINGLE();

        bundle.graph.each(function (node) {
            const edges = node.unbundleEdges(delta);
            for (let e of edges) {
                const originalEdgeId = e[0].node.id;
                const flattenCoords = [];
                for (let point of e) {
                    flattenCoords.push(point.unbundledPos[0].toFixed(3));
                    flattenCoords.push(point.unbundledPos[1].toFixed(3));
                }
                edgeCoords[originalEdgeId] = flattenCoords;
            }
        });
    }

    const endTime = new Date();
    console.log("Edge bundling takes ", (endTime.getTime() - startTime.getTime()) / 1000, "s");
    return {
        umap: coords.map((c) => ({ x: c.x.toFixed(3), y: c.y.toFixed(3) })),
        edgeBundlePoints: edgeCoords,
    };
}

function neighborBinning(coords, neighborMasksByHop, m) {
    console.log("Neighbor binning...");
    const binsByHop = [];

    // Init bins
    function copyBins(oriBins) {
        const bins = new Array(m);
        for (let i = 0; i < m; i++) {
            bins[i] = new Array(m);
            for (let j = 0; j < m; j++) {
                bins[i][j] = new Array(m);
                for (let k = 0; k < m; k++) {
                    if (!oriBins) {
                        bins[i][j][k] = new Array(m).fill(0);
                    } else {
                        bins[i][j][k] = oriBins[i][j][k].slice();
                    }
                }
            }
        }
        return bins;
    }

    // Init node mapping from block (x,y) -> node IDs
    const mapping = new Array(m);
    for (let i = 0; i < m; i++) {
        mapping[i] = new Array(m);
        for (let j = 0; j < m; j++) {
            mapping[i][j] = [];
        }
    }

    const extentX = extent(coords.map((c) => c.x)),
        extentY = extent(coords.map((c) => c.y));
    const r = new Array(m).fill(0).map((_, i) => i);
    const scaleX = scaleQuantize().domain(extentX).range(r),
        scaleY = scaleQuantize().domain(extentY).range(r);

    let bins = null,
        maxBinVals = new Array(neighborMasksByHop.length).fill(0);
    for (let h = 0; h < neighborMasksByHop.length; h++) {
        const masks = neighborMasksByHop[h];
        if (!bins) {
            bins = copyBins(0);
        } else {
            bins = copyBins(bins);
        }
        for (let nodeId = 0; nodeId < masks.length; nodeId++) {
            const x = scaleX(coords[nodeId].x),
                y = scaleY(coords[nodeId].y);
            if (h === 0) {
                mapping[x][y].push(nodeId);
            }
            for (let tid of masks[nodeId].toArray()) {
                const a = scaleX(coords[tid].x),
                    b = scaleY(coords[tid].y);
                bins[x][y][a][b]++;
                maxBinVals[h] = Math.max(maxBinVals[h], bins[x][y][a][b]);
            }
        }
        binsByHop.push(bins);
    }
    return { binsByHop, maxBinVals, granu: m, mapping };
}

const datasetId = process.argv[2];
console.log("==============");
console.log("Pre-pocessing dataset ", datasetId);
const dataDir = `./${datasetId}`;
const graph = require(`${dataDir}/graph.json`);
const numNodes = graph.nodes.length;
const hops = getHops(datasetId);
graph.hops = hops;
const distMetric = "jaccard";
console.log("#hops=", hops);
console.log("#nodes=", numNodes);

// Remove duplicate edges, self loops
if (!graph.edges) {
    Object.assign(graph, filterEdgeAndComputeDict(numNodes, graph.links));
}
console.log("After filtering, #edges=", graph.edges.length);

// Compute neighbor masks
Object.assign(graph, computeNeighborMasks(numNodes, graph.edgeDict, hops));

// Compute distances
// Init distance matrices first
function initDistMat(n) {
    let d = {};
    for (let i = 0; i < n; i++) {
        d[i] = { [i]: 0 };
    }
    return d;
}
const distMatLatent = initDistMat(numNodes);
const distMatTopo = initDistMat(numNodes);
const distMatFeature = initDistMat(numNodes);

// read the embeddings
let emb = [];
fs.createReadStream(`${dataDir}/node-embeddings.csv`)
    .pipe(csvParser({ headers: false }))
    .on("data", (data) => {
        const d = [];
        for (let i = 0; i < Object.keys(data).length; i++) {
            d.push(Number(data[i]));
        }
        emb.push(d);
    })
    .on("end", () => {
        // Compute UMAP
        getUMAPresults(`${dataDir}/umap.csv`, emb).then((umapRes) => {
            console.log("UMAP results obtained.");

            const coords = umapRes.map((r) => ({ x: r[0], y: r[1] }));
            const b = neighborBinning(coords, graph.neighborMasksByHop, BIN_GRANULARITY);
            const e = performEdgeBundling(graph.edges, coords);

            writeFile(`${dataDir}/umap.json`, JSON.stringify({ ...e, neighborBinning: b })).then(() => {
                console.log("Writing UMAP results successfully!");
            });
        });

        // Read the features
        let attrs = null,
            denseFeatures = null;
        try {
            attrs = require(`${dataDir}/attr-meta.json`);
            denseFeatures = normalizeFeatures(attrs, graph.nodes);
        } catch (e) {
            console.log("No dense features");
        }
        let sparseFeatures = null,
            features = null;
        fs.readFile(`${dataDir}/features.csv`, async (e, data) => {
            if (e) {
                console.log("No sparse features");
            } else {
                const tmp = await neatCsv(data, { headers: false });
                sparseFeatures = [];
                const numFeat = Object.keys(tmp[0]).length;
                console.log("#features = ", numFeat);
                for (let t of tmp) {
                    const d = [];
                    for (let i = 0; i < numFeat; i++) {
                        d.push(Number(t[i]));
                    }
                    sparseFeatures.push(d);
                }
            }
            features = sparseFeatures ? sparseFeatures : denseFeatures;

            // Compute all distances between any pairs
            const types = graph.nodes[0].type ? graph.nodes.map((n) => n.type) : new Array(numNodes).fill(0);
            let featureDistMax = 0;
            if (features) {
                featureDistMax = getFeatureDistMax(numNodes, features);
                console.log("featureDistMax = ", featureDistMax);
            }
            const distSample = computeDistances(
                (numNodes * (numNodes - 1)) / 2 < maxNumPairs ? "all" : "sample",
                numNodes,
                types,
                graph.edges,
                emb,
                graph.neighborMasks,
                features,
                featureDistMax
            );
            const distEdge = computeDistances(
                "edge",
                numNodes,
                types,
                graph.edges,
                emb,
                graph.neighborMasks,
                features,
                featureDistMax
            );

            // Write distances to disk
            const distJson = JSON.stringify({
                // distMatFeature,
                // distMatTopo,
                // distMatLatent,
                featureDistMax: featureDistMax,
                distSample,
                distEdge,
            });
            writeFile(`${dataDir}/distances.json`, distJson).then(() => {
                console.log("Writing distance data successfully!");
            });

            // Write the preprocessed graph to disk
            delete graph["links"];
            const graphJson = JSON.stringify({
                ...graph,
                sparseFeatures,
                denseFeatures,
                neighborMasks: graph.neighborMasks.map((m) => m.toString((base = 16))),
                neighborMasksByHop: graph.neighborMasksByHop.map((h) =>
                    h.map((m) => m.toString((base = 16)))
                ),
            });
            writeFile(`${dataDir}/graph.json`, graphJson).then(() => {
                console.log("Writing graph data successfully");
            });
        });
    });

// Compute intialLayout
layout = computeForceLayoutWithD3(graph.nodes.length, graph.edges, padding, false);

layout.coords = layout.coords.map((c) => ({ x: c.x.toFixed(2), y: c.y.toFixed(2) }));
writeFile(`${dataDir}/initial-layout.json`, JSON.stringify(layout)).then(() => {
    console.log("Writing intial layout successfully!");
});
