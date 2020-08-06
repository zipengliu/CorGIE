import {
    scaleLinear,
    extent,
    deviation,
    forceSimulation,
    forceCollide,
    forceManyBody,
    forceLink,
    forceCenter,
    forceX,
    forceY,
    linkRadial,
    transition,
    lab,
} from "d3";
import { Layout as cola } from "webcola";
import tSNE from "./tsne";
import { UMAP } from "umap-js";

const EPSILON = 1e-8;

// Input: a distance matrix
// Output: an array of coordinates (x, y)
export function runTSNE(dist, spec) {
    let opt = { epsilon: 10, perplexity: 30, dim: 2 };
    let tsne = new tSNE.tSNE(opt);
    tsne.initDataDist(dist);

    console.log("Begin tSNE");
    let iterations;
    if (dist.length < 100) {
        iterations = 400;
    } else if (dist.length < 500) {
        iterations = 300;
    } else if (dist.length < 1000) {
        iterations = 200;
    } else {
        iterations = 200;
    }
    console.log("tsne iterations: ", iterations);
    for (let k = 0; k < iterations; k++) {
        tsne.step();
    }
    console.log("Finish tSNE");

    // Normalize the coordinates to (0, 1) by linear transformation
    // how much do you want to relax the extent of the coordinates so that they don't show up on the border of the dotplot
    // let relaxCoefficient = 0.2;
    let coords = coordsRescale(tsne.getSolution(), spec.width, spec.height);

    return avoidOverlap(coords, 0.1);
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

function avoidOverlap(coords, r) {
    let nodes = coords.map((d, i) => ({ ...d, index: i }));
    let simulation = forceSimulation(nodes).force("collide", forceCollide(r)).stop();
    for (let i = 0; i < 100; i++) {
        simulation.tick();
    }
    return nodes.map((d) => ({ x: d.x, y: d.y }));
}

export function getDistanceMatrixFromEmbeddings(emb) {
    let d = [];
    for (let i = 0; i < emb.length; i++) {
        let cur = [];
        for (let j = 0; j < i; j++) {
            cur.push(d[j][i]);
        }
        cur.push(0);
        for (let j = i + 1; j < emb.length; j++) {
            cur.push(getCosineDistance(emb[i], emb[j]));
        }
        d.push(cur);
    }
    return d;
}

export function getAllNodeDistance(emb, edges) {
    let f = [];
    console.log(emb.length);
    for (let i = 0; i < emb.length; i++) {
        f.push(new Array(emb.length).fill(false));
    }
    for (let e of edges) {
        f[e.source][e.target] = true;
        f[e.target][e.source] = true;
    }

    let d = [];
    let m = [];
    for (let i = 0; i < emb.length; i++) {
        // Make sure i < j to avoid duplicate computation
        m.push(new Array(emb.length));
        for (let j = i + 1; j < emb.length; j++) {
            const cosD = getCosineDistance(emb[i], emb[j]);
            d.push({ i, j, d: cosD, p: f[i][j] });
            m[i][j] = cosD;
        }
        for (let j = 0; j < i; j++) {
            m[i][j] = m[j][i];
        }
        m[i][i] = 0;
    }
    return { nodeDist: d, distMatrix: m };
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
    let sim = mag > EPSILON ? p / mag : 1.0;
    // console.log(sim);
    return 1.0 - sim;
}

export function computeForceLayoutWithD3(nodes, edges) {
    // const constrainCoord = (v, min, max) => Math.max(min, Math.min(v, max));
    let coords = nodes.map((n, i) => ({ index: i }));

    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 800));

    let simulation = forceSimulation(coords)
        .force("link", forceLink(edges))
        .force("charge", forceManyBody().strength(-40))
        .force("x", forceX(canvasSize / 2))
        .force("y", forceY(canvasSize / 2))
        .stop();
    simulation.tick(300);

    return { coords: coords.map((d) => ({ x: d.x, y: d.y })), width: canvasSize, height: canvasSize };
}

export function computeForceLayoutWithCola(nodes, edges, spec) {
    let coords = nodes.map((n, i) => ({
        index: i,
        width: (n.typeId === 0 ? spec.centralNodeSize : spec.auxNodeSize) * 2,
        height: (n.typeId === 0 ? spec.centralNodeSize : spec.auxNodeSize) * 2,
    }));
    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 800));

    let simulation = new cola()
        .size([canvasSize, canvasSize])
        .nodes(coords)
        .links(edges)
        .linkDistance(10)
        // .avoidOverlaps(true)
        // .symmetricDiffLinkLengths(2, 1)
        // .jaccardLinkLengths(15, 2)
        .start(10, 15, 20);

    for (let i = 0; i < 300; i++) {
        simulation.tick();
    }

    return { coords: coords.map((d) => ({ x: d.x, y: d.y })), width: canvasSize, height: canvasSize };
}

export function computeDummyLayout(nodes) {
    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 100));
    return {
        coords: nodes.map((_) => ({ x: Math.random() * canvasSize, y: Math.random() * canvasSize })),
        width: canvasSize,
        height: canvasSize,
    };
}

// Compute a circular layout with an inner ring for one central node type and outer ring for other node types
// Minimize edge-edge crossing by positioning neighbor nodes closer to the central node and edge bundling (TODO)
// TODO: host multiple central node types
export function computeCircularLayout(nodes, edges, spec, centralNodeType) {
    const centralNodes = nodes.filter((n) => n.typeId === centralNodeType);
    const auxNodes = nodes.filter((n) => n.typeId !== centralNodeType);
    const centralNodesCnt = centralNodes.length,
        auxNodesCnt = auxNodes.length;
    console.log({ centralNodesCnt, auxNodesCnt });

    const { centralNodeSize, auxNodeSize, innerRingNodeGap, outerRingNodeGap, minRingGap } = spec;

    const innerAngle = (2 * Math.PI) / centralNodesCnt;
    const outerAngle = (2 * Math.PI) / auxNodesCnt;
    const innerRadius = (centralNodeSize + innerRingNodeGap) / Math.sin(innerAngle);
    let outerRadius = (auxNodeSize + outerRingNodeGap) / Math.sin(outerAngle);
    if (outerRadius - innerRadius < minRingGap) {
        outerRadius = innerRadius + minRingGap;
    }
    const canvasSize = 2 * (outerRadius + auxNodeSize);
    // console.log({ innerRadius, outerRadius });

    function polar(r, a) {
        return { x: r * Math.cos(a), y: r * Math.sin(a) };
    }

    let i = 0,
        j = 0,
        coords = [],
        polarCoords = [];
    for (let n of nodes) {
        if (n.typeId === centralNodeType) {
            polarCoords.push({ a: i * innerAngle, r: innerRadius, s: centralNodeSize, x: innerRadius, y: 0 });
            coords.push({ ...polar(innerRadius, i * innerAngle), s: centralNodeSize });
            i++;
        } else {
            polarCoords.push({ a: j * outerAngle, r: outerRadius, s: auxNodeSize, x: outerRadius, y: 0 });
            coords.push({ ...polar(outerRadius, j * outerAngle), s: auxNodeSize });
            j++;
        }
    }

    // const linkGen = linkRadial()
    //     .radius(d => d.r)
    //     .angle(d => d.a);

    // for (let e of edges) {
    //     let sid = e.source, tid = e.target;
    //     e.curvePath = linkGen({
    //         source: polarCoords[sid],
    //         target: polarCoords[tid]
    //     });
    //     e.source = {
    //         index: sid,
    //         ...coords[sid]
    //     };
    //     e.target = {
    //         index: tid,
    //         ...coords[tid]
    //     };
    // }

    // Change the angle unit from radian to degree, and prepare for rotation transform in rendering
    return {
        coords: polarCoords.map((c) => ({ ...c, a: (c.a * 180) / Math.PI })),
        width: canvasSize,
        height: canvasSize,
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
                return 20 * getNeighborDistance(neighMap[e.source].mask, neighMap[e.target].mask, distMetric);
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
                        dist:
                            getNeighborDistance(
                                neighMap[neighId1].mask,
                                neighMap[neighId2].mask,
                                distMetric
                            ) + 1,
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

export function computeSpaceFillingCurveLayout(
    nodes,
    hops,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighArr,
    neighMap,
    distMetric
) {
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
            d = getNeighborDistance(
                neighMap[orderedNodes[i]].mask,
                neighMap[orderedNodes[i - 1]].mask,
                distMetric
            );
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

export function computeLocalLayoutWithUMAP(
    nodes,
    edges,
    hops,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighArr,
    neighMap,
    distMetric,
    spec
) {
    let embeddings = [];
    for (let i = 0; i < hops; i++) {
        let r;
        if (neighArr[i].length <= 15) {
            // not enough data points
            // use random embeddings
            r = neighArr[i].map((_) => [Math.random(), Math.random()]);
        } else {
            const data = neighArr[i].map((x) => [x]);
            // Construct a local distanace matrix
            // let m = new Array(neighArr[i].length);
            // for (let j = 0; j < neighArr[i].length; j++) {
            //     m[j] = new Array(neighArr[i].length);
            // }
            // for (let j = 0; j < neighArr[i].length; j++) {
            //     for (let k = 0; k < j - 1; k++) {
            //         m[k][j] = m[j][k];
            //     }
            //     m[j][j] = 0;
            //     for (let k = j + 1; k < neighArr[i].length; k++) {
            //         m[j][k] = getNeighborDistance(
            //             neighMap[neighArr[i][j]].mask,
            //             neighMap[neighArr[i][k]].mask,
            //             distMetric
            //         );
            //     }
            // }

            console.log("Calling UMAP: ", data.length);
            const distFunc = (x, y) =>
                getNeighborDistance(neighMap[x[0]].mask, neighMap[y[0]].mask, distMetric);
            // const distFunc = (x, y) => m[x[0]][y[0]];
            const sim = new UMAP({ distanceFn: distFunc });
            r = sim.fit(data);
        }
        embeddings.push(r);
    }
    console.log({ embeddings });

    // Resize the embeddings for the four different groups of nodes: selected, 1-hop, 2-hop, others
    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 1000));
    const n = nodes.length;
    const n1 = Object.keys(isNodeSelected).length,
        n2 = neighArr[0].length,
        n3 = neighArr[1].length,
        n4 = n - n1 - n2 - n3;
    const nums = [n1, n2, n3, n4];
    const coords = new Array(n);
    const gap = 30;
    let groups = [];
    let yOffset = gap;
    for (let i = 0; i < 4; i++) {
        // The allocated height for this group of nodes
        const height = ((canvasSize - 4 * gap) / n) * nums[i];
        groups.push({
            bounds: { x: 0, y: yOffset - gap / 3, width: canvasSize, height: height + (gap / 3) * 2 },
        });
        let emb, xExtent, yExtent, xRange, yRange;
        if (i === 0 || i === 3) {
            // Assign a random embedding for now
            // TODO
        } else {
            emb = embeddings[i - 1];
            xExtent = extent(emb.map((e) => e[0]));
            yExtent = extent(emb.map((e) => e[1]));
            xRange = xExtent[1] - xExtent[0];
            yRange = yExtent[1] - yExtent[0];
            console.log({ i, xExtent, yExtent });
        }

        // Fit emb to the allocated space
        if (i === 1 || i === 2) {
            for (let j = 0; j < neighArr[i - 1].length; j++) {
                const nodeId = neighArr[i - 1][j];
                coords[nodeId] = {
                    x: ((emb[j][0] - xExtent[0]) * canvasSize) / xRange,
                    y: yOffset + ((emb[j][1] - yExtent[0]) * height) / yRange,
                };
            }
        } else if (i === 0) {
            for (let nodeId in isNodeSelected)
                if (isNodeSelected.hasOwnProperty(nodeId)) {
                    coords[nodeId] = {
                        x: Math.random() * canvasSize,
                        y: yOffset + Math.random() * height,
                    };
                }
        } else {
            // Other nodes
            for (let nodeId = 0; nodeId < n; nodeId++) {
                if (!isNodeSelected[nodeId] && !isNodeSelectedNeighbor[nodeId]) {
                    coords[nodeId] = {
                        x: Math.random() * canvasSize,
                        y: yOffset + Math.random() * height,
                    };
                }
            }
        }
        yOffset += height + gap;
    }
    console.log({ coords });

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

// Get the positional color for a node that sits at (x, y), where x,y is in [0,1]
const labScale = scaleLinear().domain([0, 1]).range([-160, 160]);
export function getNodeEmbeddingColor(x, y) {
    const a = labScale(x),
        b = labScale(y);
    const l = 60;
    return lab(l, a, b).formatHex();
}
