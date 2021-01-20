import bs from "bitset";
import { scaleLinear, extent, lab } from 'd3';

export function aggregateBinaryFeatures(features, highlightNodes) {
    const m = features[0].length;
    const res = new Array(m).fill(0);
    if (!highlightNodes) {
        for (let f of features) {
            for (let i = 0; i < m; i++) {
                res[i] += f[i];
            }
        }
    } else {
        for (let nodeId of highlightNodes) {
            for (let i = 0; i < m; i++) {
                res[i] += features[nodeId][i];
            }
        }
    }
    return res;
}

export function compressFeatureValues(values, maxWidth) {
    const sortedVal = values.slice().sort((a, b) => b - a);
    const n = values.length;
    // Compression ratio
    const r = Math.ceil(n / maxWidth);

    const compValues = [];
    for (let i = 0; i < n; i += r) {
        let t = 0;
        for (let j = i; j < n && j < i + r; j++) {
            t += sortedVal[j];
        }
        compValues.push(t / r);
    }
    return compValues;
}

// Rescale the coordinates to [0,0]-[w,h]
export function coordsRescale(coords, w, h) {
    let xArr = coords.map((x) => x[0]);
    let yArr = coords.map((x) => x[1]);
    let xExtent = extent(xArr);
    let yExtent = extent(yArr);

    let xScale = scaleLinear().domain(xExtent).range([0, w]);
    let yScale = scaleLinear().domain(yExtent).range([0, h]);

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
    let sim = mag > Number.EPSILON ? p / mag : 1.0;
    // console.log(sim);
    return 1.0 - sim;
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

    for (let g of selectedNodes) {
        for (let nodeIdx of g) {
            isNodeSelected[nodeIdx] = true;
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
