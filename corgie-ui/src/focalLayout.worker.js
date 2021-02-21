import * as Comlink from "comlink";
import { extent, forceSimulation, forceManyBody, forceLink, forceX, forceY, scaleSqrt, scaleLog } from "d3";
import { Layout as cola } from "webcola";
import { UMAP } from "umap-js";
import bs from "bitset";
import { getNeighborDistance } from "./utils";

const maxNumNodes = 10000;
let state = {
    numNodes: null,
    edges: null,
    distMetric: null,
    hops: 0,
    neighborMasks: null,
    getCanvasSize: scaleSqrt().domain([1, maxNumNodes]).range([400, 1000]).clamp(true),
    spec: null,
};

function initializeState(numNodes, neighborMasks, hops, distMetric, spec) {
    state.numNodes = numNodes;
    state.neighborMasks = neighborMasks.map((m) => bs(m));
    state.hops = hops;
    state.distMetric = distMetric;
    state.spec = spec;
}

// The bitset class functions are not copied from the main thread,
// so we need to re-construct the bitsets in-place
function reconstructBitsets(neighMap) {
    for (let id in neighMap)
        if (neighMap.hasOwnProperty(id)) {
            neighMap[id] = bs(neighMap[id]);
        }
}

function computeFocalLayoutWithUMAP(
    selectedNodes,
    isNodeSelected,
    isNodeSelectedNeighbor,
    neighArr,
    localNeighMap // node connection signature: either global or local
) {
    const runUMAP = (nodeIdxArr, masks) => {
        if (nodeIdxArr.length < 15) {
            // Not enough data to compute UMAP
            // Consider something that reduces edge crossings?
            return nodeIdxArr.map((_) => [Math.random(), Math.random()]);
        } else {
            console.log("Calling UMAP... #nodes =", nodeIdxArr.length);
            const distFunc = (x, y) => getNeighborDistance(masks[x], masks[y], state.distMetric); // Global signature
            const sim = new UMAP({ distanceFn: distFunc });
            return sim.fit(nodeIdxArr);
        }
    };

    console.log("Computing local layout with UMAP...", new Date());

    reconstructBitsets(localNeighMap);
    const n = state.numNodes,
        numFoc = selectedNodes.length;
    const { hops } = state;
    const { margin, gapBetweenHop } = state.spec;

    // Compute embeddings for each hop
    let embeddings = [[]];
    for (let s of selectedNodes) {
        embeddings[0].push(runUMAP(s, state.neighborMasks));
    }
    for (let i = 1; i <= hops; i++) {
        embeddings.push(runUMAP(neighArr[i - 1], localNeighMap ? localNeighMap : state.neighborMasks));
    }
    // Use random for the others as they are not important at the moment
    // embeddings.push(others.map(() => [Math.random(), Math.random()]));
    // console.log({ embeddings });

    // Rescale the UMAP embeddings to a width x height rectangular space
    let rescale = (nodes, emb, width, height, xOffset, yOffset, margin) => {
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
            for (let i = 0; i < nodes.length; i++) {
                coords[nodes[i]] = {
                    x: xOffset + ((emb[i][0] - xExtent[0]) * (width - 2 * margin)) / xRange + margin,
                    y: yOffset + ((emb[i][1] - yExtent[0]) * (height - 2 * margin)) / yRange + margin,
                };
            }
        }
    };

    // Get the number of nodes for each hop
    const nums = [selectedNodes.reduce((prev, cur) => prev + cur.length, 0)];
    for (let nei of neighArr) {
        nums.push(nei.length);
    }
    // nums.push(others.length);

    // Allocate space for each hop
    const canvasHeight = state.getCanvasSize(n),
        canvasWidth = canvasHeight * 1.5;
    // Resize the embeddings for the four different groups of nodes: selected, 1-hop, 2-hop, 3-hop,...
    const weights = [10, 10];
    console.assert(hops <= 5);
    for (let i = 2; i <= hops; i++) {
        weights.push(weights[weights.length - 1] - 2);
    }
    const weightedSum = nums.reduce((prev, cur, i) => prev + Math.log2(cur + 1) * weights[i], 0);
    const usableWidth = canvasWidth - hops * gapBetweenHop;
    const groupWidths = nums.map((ni, i) => ((weights[i] * Math.log2(ni + 1)) / weightedSum) * usableWidth);
    const groupHeights = [
        selectedNodes.map((s) =>
            Math.min(groupWidths[0], ((canvasHeight - (numFoc - 1) * gapBetweenHop) / nums[0]) * s.length)
        ),
    ];
    for (let i = 1; i <= hops; i++) {
        groupHeights.push(Math.min(canvasHeight, groupWidths[i]));
    }
    console.log({ canvasWidth, canvasHeight, nums, weights, weightedSum, groupWidths, groupHeights });

    const coords = new Array(n);
    let groups = [];
    let xOffset = 0,
        yOffset = 0,
        actualGapFocal = 0;
    // position the focal groups
    if (numFoc > 1) {
        const focalHeightSum = groupHeights[0].reduce((prev, cur) => prev + cur, 0);
        actualGapFocal = (canvasHeight - focalHeightSum) / (numFoc - 1);
    } else {
        yOffset = (canvasHeight - groupHeights[0][0]) / 2;
    }
    for (let j = 0; j < numFoc; j++) {
        const w = Math.min(groupHeights[0][j], groupWidths[0]);
        const bbox = {
            x: xOffset + (groupWidths[0] - w) / 2,
            y: yOffset,
            width: w,
            height: groupHeights[0][j],
        };
        groups.push({ bounds: bbox });
        rescale(selectedNodes[j], embeddings[0][j], bbox.width, bbox.height, bbox.x, bbox.y, margin);
        yOffset += bbox.height + actualGapFocal;
    }
    xOffset += groupWidths[0] + gapBetweenHop;
    for (let i = 1; i <= hops; i++) {
        const bbox = {
            x: xOffset,
            y: (canvasHeight - groupHeights[i]) / 2,
            width: groupWidths[i],
            height: groupHeights[i],
        };
        groups.push({ bounds: bbox });
        rescale(neighArr[i - 1], embeddings[i], bbox.width, bbox.height, bbox.x, bbox.y, margin);
        xOffset += groupWidths[i] + gapBetweenHop;
    }

    // yOffset = 0;
    // for (let i = 0; i < 4; i++) {
    //     const b = {
    //         x: 0,
    //         y: yOffset - gap / 3,
    //         width: canvasSize,
    //         height: height + (gap / 3) * 2,
    //     };
    //     if (i == 0 && selectedNodes.length > 1) {
    //         // Seperate the two selected groups
    //         width = (canvasSize - selectedNodesSep) / 2;
    //         groups.push({ bounds: { ...b, width } });
    //         groups.push({ bounds: { ...b, x: width + selectedNodesSep, width } });
    //     } else {
    //         groups.push({ bounds: b });
    //     }
    //     if (i == 0) {
    //         rescale(selectedNodes[0], embeddings[0][0], width, height, 0, yOffset);
    //         if (selectedNodes.length > 1) {
    //             rescale(selectedNodes[1], embeddings[0][1], width, height, width + selectedNodesSep, yOffset);
    //         }
    //     } else {
    //         rescale(nodesByHop[i], embeddings[i], width, height, 0, yOffset);
    //     }
    //     yOffset += height + gap;
    // }
    console.log("UMAP layout computed!", new Date());
    console.log({ groups, coords });

    return {
        coords,
        groups,
        width: canvasWidth,
        height: canvasHeight,
    };
}

function computeFocalLayoutWithCola(
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

function computeFocalLayoutWithD3(
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

function computeSpaceFillingCurveLayout(
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

Comlink.expose({
    initializeState: initializeState,
    computeFocalLayoutWithCola: computeFocalLayoutWithCola,
    computeFocalLayoutWithD3: computeFocalLayoutWithD3,
    computeFocalLayoutWithUMAP: computeFocalLayoutWithUMAP,
    computeSpaceFillingCurveLayout: computeSpaceFillingCurveLayout,
});
