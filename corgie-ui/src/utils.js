import bs from "bitset";
import { scaleLinear, extent, lab } from "d3";

export function aggregateBinaryFeatures(features, highlightNodes, computeMapping = true) {
    const m = features[0].length;
    const cnts = new Array(m).fill(0);
    const featToNid = {};

    function handleFeature(nid, f) {
        for (let i = 0; i < m; i++) {
            if (f[i] > 0) {
                cnts[i] += f[i];
                if (computeMapping) {
                    if (!featToNid.hasOwnProperty(i)) {
                        featToNid[i] = [];
                    }
                    featToNid[i].push(nid);
                }
            }
        }
    }
    if (!highlightNodes) {
        for (let nid = 0; nid < features.length; nid++) {
            handleFeature(nid, features[nid]);
        }
    } else {
        for (let nodeId of highlightNodes) {
            handleFeature(nodeId, features[nodeId]);
        }
    }
    return { cnts, featToNid };
}

export function getCompressFeatureMapping(numFeatures, maxNumStrips) {
    const r = Math.ceil(numFeatures / maxNumStrips);
    const numStrips = Math.ceil(numFeatures / r);
    const m = new Array(numStrips).fill(0).map((_, i) => {
        const x = [];
        const start = i * r;
        for (let j = 0; j < r && start + j < numFeatures; j++) {
            x.push(start + j);
        }
        return x;
    });
    return m;
}
// maxWidth: max number of bins / strips
export function compressFeatureValues(values, maxNumStrips, sort = false) {
    const sortedVal = sort ? values.slice().sort((a, b) => b - a) : values;
    const n = values.length;
    // Compression ratio
    const r = Math.ceil(n / maxNumStrips);
    // console.log("feature compress rate = ", r);

    const compValues = [];
    for (let i = 0; i < n; i += r) {
        let t = 0;
        for (let j = 0; j < r && i + j < n; j++) {
            t = Math.max(t, sortedVal[i + j]); // Use the max function to aggreagte
        }
        compValues.push(t);
    }
    return compValues;
}

// Rescale the coordinates to [0,0]-[w,h]
export function coordsRescale(coords, w, h, paddings) {
    let xArr = coords.map((x) => x[0]);
    let yArr = coords.map((x) => x[1]);
    let xExtent = extent(xArr);
    let yExtent = extent(yArr);

    let xScale = scaleLinear()
        .domain(xExtent)
        .range([paddings.left, w - paddings.left - paddings.right]);
    let yScale = scaleLinear()
        .domain(yExtent)
        .range([paddings.top, h - paddings.top - paddings.bottom]);

    return coords.map((d) => ({ x: xScale(d[0]), y: yScale(d[1]) }));
}

export function getNeighborDistance(mask1, mask2, metric) {
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

export function getCosineDistance(u, v) {
    let p = 0,
        magU = 0,
        magV = 0;
    for (let i = 0; i < u.length; i++) {
        p += u[i] * v[i];
        magU += Math.pow(u[i], 2);
        magV += Math.pow(v[i], 2);
    }
    let mag = Math.sqrt(magU) * Math.sqrt(magV);
    if (mag > Number.EPSILON) {
        return Math.max(0, 1.0 - p / mag);
    } else {
        return 1.0;
    }
}

// Get the positional color for a node that sits at (x, y), where x,y is in [0,1]
const labScale = scaleLinear().domain([0, 1]).range([-160, 160]);
export function getNodeEmbeddingColor(x, y) {
    const a = labScale(x),
        b = labScale(y);
    const l = 60;
    return lab(l, a, b).formatHex();
}

export function isPointInBox(p, box) {
    const offX = p.x - box.x,
        offY = p.y - box.y;
    return 0 <= offX && offX <= box.width && 0 <= offY && offY <= box.height;
}

// Given selected nodes (in the form of array of array), compute relevant data structures for their neighbors
// isNodeSelected, isNodeSelectedNeighbor, neighArr, neighMap
export function getSelectedNeighbors(selectedNodes, neighborMasks, hops) {
    if (!selectedNodes) return;
    let isNodeSelected = {},
        isNodeSelectedNeighbor = {},
        neighArr = [],
        neighMap = {};

    let gid = 0;
    for (let g of selectedNodes) {
        gid++;
        for (let nodeIdx of g) {
            isNodeSelected[nodeIdx] = gid;
            // Iterate its neighbors by hops
            // Compute whether a node is the neighbor of selected nodes, if yes, specify the #hops
            // The closest / smallest hop wins if it is neighbor of multiple selected nodes
            for (let h = hops - 1; h >= 0; h--) {
                const curNeigh = neighborMasks[h][nodeIdx];
                for (let neighIdx of curNeigh.toArray()) {
                    if (neighIdx !== nodeIdx) {
                        if (isNodeSelectedNeighbor.hasOwnProperty(neighIdx)) {
                            isNodeSelectedNeighbor[neighIdx] = Math.min(
                                isNodeSelectedNeighbor[neighIdx],
                                h + 1
                            );
                        } else {
                            isNodeSelectedNeighbor[neighIdx] = h + 1;
                        }
                    }
                }
            }
        }
    }

    for (let h = 0; h < hops; h++) {
        neighArr.push([]);
    }
    for (let nodeId in isNodeSelectedNeighbor)
        if (isNodeSelectedNeighbor[nodeId] && !isNodeSelected[nodeId]) {
            neighArr[isNodeSelectedNeighbor[nodeId] - 1].push(parseInt(nodeId));
        }

    let h = 0;
    let prevHopNodes = selectedNodes.flat();
    for (let curHopNeigh of neighArr) {
        // const curMasks = neighborMasks[h];
        // compute a mask for the selected nodes
        let prevHopNodesMask = bs(0);
        for (let nodeId of prevHopNodes) {
            prevHopNodesMask.set(nodeId, 1);
        }

        // Find out #connections to nodes in previous hop
        for (let neighId of curHopNeigh) {
            neighMap[neighId] = {
                mask: neighborMasks[0][neighId].and(prevHopNodesMask),
                h: h + 1,
            };
            neighMap[neighId].cnt = neighMap[neighId].mask.cardinality();
        }

        // Sort array by #conn
        curHopNeigh.sort((a, b) => neighMap[b].cnt - neighMap[a].cnt);
        // Populate the order of the node in that hop
        for (let i = 0; i < curHopNeigh.length; i++) {
            neighMap[curHopNeigh[i]].order = i;
        }
        prevHopNodes = curHopNeigh;
        h++;
    }

    return { isNodeSelected, isNodeSelectedNeighbor, neighArr, neighMap };
}

export function binarySearch(arr, v) {
    let l = 0,
        r = arr.length - 1;
    while (l <= r) {
        let m = Math.floor((l + r) / 2);
        // Access the 0-th element.  This is particularly for the node pair data struct
        const t = arr[m][0];
        if (t === v) {
            return m;
        } else if (t < v) {
            l = m + 1;
        } else {
            r = m - 1;
        }
    }
    return l;
}

export function rectBinning(data, extent, numBins) {
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

    if (data.constructor === Float32Array) {
        for (let i = 0; i < data.length; i += 2) {
            inc(data[i], data[i + 1], i >> 1);
        }
    } else {
        for (let i = 0; i < data.length; i += 1) {
            inc(data[i][0], data[i][1], i);
        }
    }
    return { bins, maxCnt: m };
}

// Comppute the neighborMasksByHop and neighborMasks (all hops combined)
export function computeNeighborMasks(numNodes, edgeDict, hops) {
    const masks = [],
        masksByHop = [];
    let last;
    for (let i = 0; i < numNodes; i++) {
        masks.push(bs(0));
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

// Filter edges: self loop and duplicates are removed.
// Note: we treat all edges as undirectional.
// Compute an edge dictionary by its source ID
export function filterEdgeAndComputeDict(numNodes, edges) {
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
