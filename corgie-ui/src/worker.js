import { extent, forceSimulation, forceManyBody, forceLink, forceX, forceY } from "d3";
import { Layout as cola } from "webcola";
import { UMAP } from "umap-js";
import bs from "bitset";
import { getNeighborDistance, getCosineDistance } from "./utils";

export function getDistancesOfAllPairs(emb) {
    console.log("Getting distances of all node pairs...", emb.length);
    let d = [];
    let m = [];
    for (let i = 0; i < emb.length; i++) {
        // Make sure i < j to avoid duplicate computation
        m.push(new Array(emb.length));
        for (let j = i + 1; j < emb.length; j++) {
            const cosD = getCosineDistance(emb[i], emb[j]);
            // TODO do I really need them or just the cosD?
            d.push([cosD, i, j]);
            m[i][j] = cosD;
        }
        for (let j = 0; j < i; j++) {
            m[i][j] = m[j][i];
        }
        m[i][i] = 0;
    }
    d.sort((x1, x2) => x1[0] - x2[0]);

    return { distArray: d, distMatrix: m };
}

// The bitset class functions are not copied from the main thread,
// so we need to re-construct the bitsets in-place
function reconstructBitsets(neighMap) {
    for (let id in neighMap)
        if (neighMap.hasOwnProperty(id)) {
            neighMap[id] = bs(neighMap[id]);
        }
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

    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 1000));
    // Resize the embeddings for the four different groups of nodes: selected, 1-hop, 2-hop, others
    const weightedN = (n1a + n1b + n2 + n3) * 1.5 + 0.5 * n4;
    const nums = [n1a + n1b, n2, n3, n4];
    const coords = new Array(n);
    const gap = 30;
    const selectedNodesSep = 40;
    let groups = [];
    let yOffset = gap;
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
        let height = ((canvasSize - 4 * gap) / weightedN) * nums[i],
            width = canvasSize;
        if (i < 3) {
            height *= 1.5;
        } else {
            height *= 0.5;
        }
        const b = {
            x: 0,
            y: yOffset - gap / 3,
            width: canvasSize,
            height: height + (gap / 3) * 2,
        };
        if (i == 0 && selectedNodes.length > 1) {
            // Seperate the two selected groups
            width = (canvasSize - selectedNodesSep) / 2;
            groups.push({ bounds: { ...b, width} });
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
