import * as Comlink from "comlink";
import {
    extent,
    forceSimulation,
    forceManyBody,
    forceLink,
    forceX,
    forceY,
    scaleSqrt,
    scaleLinear,
    dsvFormat,
} from "d3";
import { Layout as cola } from "webcola";
import { UMAP } from "umap-js";
import bs from "bitset";
import { computeEdgeDict, getNeighborDistance } from "./utils";

const maxNumNodes = 10000;
let state = {
    numNodes: null,
    edges: null,
    edgeDict: null,
    distMetric: null,
    hops: 0,
    neighborMasks: null,
    getCanvasSize: scaleSqrt().domain([1, maxNumNodes]).range([400, 1000]).clamp(true),
    spec: null,
};

function initializeState(numNodes, edges, neighborMasks, hops, distMetric, spec) {
    state.numNodes = numNodes;
    state.edges = edges;
    state.edgeDict = computeEdgeDict(numNodes, edges);
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

function getDistance2D(u, v) {
    return Math.sqrt(Math.pow(u.x - v.x, 2) + Math.pow(u.y - v.y, 2));
}

// Evaluate the readability of a layout.
// Return the node-repulsion LinLog energy (only consider edges and node pairs between groups)
function evaluateLayout(coords, nodesByHop) {
    const { edgeDict } = state;
    let energy = 0;
    let numEdges = 0,
        numPairs = 0;
    for (let i = 0; i < nodesByHop.length - 1; i++) {
        for (let prevHopNode of nodesByHop[i]) {
            for (let nextHopNode of nodesByHop[i + 1]) {
                const d = getDistance2D(coords[prevHopNode], coords[nextHopNode]);
                numPairs++;
                energy += -Math.log(d);
                if (edgeDict[prevHopNode].hasOwnProperty(nextHopNode)) {
                    energy += d;
                    numEdges++;
                }
            }
        }
    }
    console.log("Evaluate: ", { numEdges, numPairs, energy });
    return energy;
}

function computeFocalLayoutWithUMAP(
    selectedNodes,
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
    const { padding, gapBetweenHop } = state.spec;

    const nodesByHop = [[]];

    // Compute embeddings for each hop
    let embeddings = [[]];
    for (let s of selectedNodes) {
        embeddings[0].push(runUMAP(s, state.neighborMasks));
        nodesByHop[0] = nodesByHop[0].concat(s);
    }
    for (let i = 1; i <= hops; i++) {
        embeddings.push(runUMAP(neighArr[i - 1], localNeighMap ? localNeighMap : state.neighborMasks));
        nodesByHop.push(neighArr[i - 1]);
    }
    // Use random for the others as they are not important at the moment
    // embeddings.push(others.map(() => [Math.random(), Math.random()]));
    // console.log({ embeddings });

    // Rescale the UMAP embeddings to a width x height rectangular space
    let rescale = (nodes, emb, width, height, xOffset, yOffset, padding) => {
        if (nodes.length === 1) {
            // Only one node, place it in the middle
            coords[nodes[0]] = { x: xOffset + width / 2, y: yOffset + height / 2 };
        } else {
            const xExtent = extent(emb.map((e) => e[0])),
                yExtent = extent(emb.map((e) => e[1]));
            const xScale = scaleLinear()
                    .domain(xExtent)
                    .range([xOffset + padding, xOffset + width - padding]),
                yScale = scaleLinear()
                    .domain(yExtent)
                    .range([yOffset + padding, yOffset + height - padding]);
            for (let i = 0; i < nodes.length; i++) {
                coords[nodes[i]] = {
                    x: xScale(emb[i][0]),
                    y: yScale(emb[i][1]),
                };
            }
        }
    };

    function flipGroup(nodes, oldCoords, newCoords, isHorizontal, bbox) {
        const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        for (let nid of nodes) {
            if (isHorizontal) {
                newCoords[nid] = {
                    x: -(coords[nid].x - center.x) + center.x,
                    y: coords[nid].y,
                };
            } else {
                newCoords[nid] = {
                    x: coords[nid].x,
                    y: -(coords[nid].y - center.y) + center.y,
                };
            }
        }
    }

    // rotate one group within a bbox.  Results are recorded in newCoords in place.
    function rotateGroup(nodes, oldCoords, newCoords, degree, bbox) {
        if (nodes.length === 1) {
            // No change
            newCoords[nodes[0]] = { ...oldCoords[nodes[0]] };
            return;
        }
        const r = (degree / 180) * Math.PI;
        const transMatrix = [
            [Math.cos(r), -Math.sin(r)],
            [Math.sin(r), Math.cos(r)],
        ];
        const tempCoords = [];
        for (let nid of nodes) {
            const c = oldCoords[nid];
            // Change in place
            tempCoords.push({
                x: transMatrix[0][0] * (c.x - bbox.x) + transMatrix[0][1] * (c.y - bbox.y),
                y: transMatrix[1][0] * (c.x - bbox.x) + transMatrix[1][1] * (c.y - bbox.y),
            });
        }
        // rescale since nodes might go out of bbox
        const xExtent = extent(tempCoords.map((t) => t.x)),
            yExtent = extent(tempCoords.map((t) => t.y));
        const xScale = scaleLinear()
                .domain(xExtent)
                .range([bbox.x + padding, bbox.x + bbox.width - padding]),
            yScale = scaleLinear()
                .domain(yExtent)
                .range([bbox.y + padding, bbox.y + bbox.height - padding]);
        for (let i = 0; i < nodes.length; i++) {
            newCoords[nodes[i]] = {
                x: xScale(tempCoords[i].x),
                y: yScale(tempCoords[i].y),
            };
        }
        // console.log({ degree, nodes, newCoords });
    }

    // Get the number of nodes for each hop
    const nums = nodesByHop.map((n) => n.length);

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
            x: xOffset + (groupWidths[0] - w),
            y: yOffset,
            width: w,
            height: groupHeights[0][j],
        };
        groups.push({ bounds: bbox, name: `foc-${j}` });
        rescale(selectedNodes[j], embeddings[0][j], bbox.width, bbox.height, bbox.x, bbox.y, padding);
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
        groups.push({ bounds: bbox, name: `hop-${i}` });
        rescale(neighArr[i - 1], embeddings[i], bbox.width, bbox.height, bbox.x, bbox.y, padding);
        xOffset += groupWidths[i] + gapBetweenHop;
    }

    // Find the best rotation
    const rotDegrees = [0, 90, 180, 270];
    let bestCoords = coords,
        bestEnergy = Number.MAX_SAFE_INTEGER,
        bestTrans = null;
    const newCoords = coords.map((c) => ({ ...c }));
    const trans = [];
    let numTrans = 0;
    // enumerate transformation of each group
    function dfs(groupIdx) {
        if (groupIdx == groups.length) {
            numTrans++;
            console.log(`Transformation settings #${numTrans}: `, trans.slice());
            const e = evaluateLayout(newCoords, nodesByHop);
            if (e < bestEnergy) {
                bestEnergy = e;
                bestCoords = newCoords.map((c) => ({ ...c }));
                bestTrans = trans.slice();
            }
            return;
        }
        const groupNodes = groupIdx < numFoc ? selectedNodes[groupIdx] : nodesByHop[groupIdx - numFoc + 1];
        if (groupNodes.length > 1) {
            const bbox = groups[groupIdx].bounds;
            for (let d of rotDegrees) {
                if (d > 0) {
                    rotateGroup(groupNodes, coords, newCoords, d, bbox);
                }
                trans.push(`rotate ${d}`);
                dfs(groupIdx + 1);
                trans.pop();
            }
            flipGroup(groupNodes, coords, newCoords, true, bbox);
            trans.push('flip horizontally');
            dfs(groupIdx + 1);
            trans.pop();

            flipGroup(groupNodes, coords, newCoords, false, bbox);
            trans.push('flip vertically');
            dfs(groupIdx + 1);
            trans.pop();
        } else {
            if (groupNodes.length === 1) {
                newCoords[groupNodes[0]] = coords[groupNodes[0]];
            }
            dfs(groupIdx + 1);
        }
    }
    dfs(0);

    console.log({bestEnergy, bestTrans});
    console.log("UMAP layout finished! ", new Date());

    return {
        name: "grouped UMAP",
        coords: bestCoords,
        groups,
        width: canvasWidth,
        height: canvasHeight,
    };
}

function computeFocalLayoutWithCola(selectedNodes, neighArr, localNeighMap, nodeSize) {
    console.log("Computing local layout with WebCola...", new Date());

    reconstructBitsets(localNeighMap);
    const { numNodes, spec, distMetric, edges, hops, neighborMasks } = state;
    const { padding, gapBetweenHop } = spec;
    const numFoc = selectedNodes.length;

    // Remap the node id since we don't want the outside nodes in the focal layout
    // mapping from original ID to new ID;
    const nodeMapping = {},
        reverseMapping = {};
    let k = 0;
    for (let s of selectedNodes) {
        for (let nid of s) {
            nodeMapping[nid] = k;
            reverseMapping[k] = nid;
            k++;
        }
    }
    for (let h = 0; h < hops; h++) {
        for (let nid of neighArr[h]) {
            nodeMapping[nid] = k;
            reverseMapping[k] = nid;
            k++;
        }
    }
    const remappedEdges = edges
        .filter((e) => nodeMapping.hasOwnProperty(e.source) && nodeMapping.hasOwnProperty(e.target))
        .map((e) => ({
            source: nodeMapping[e.source],
            target: nodeMapping[e.target],
        }));

    // Construct group info for webcola
    const coords = [],
        groups = [],
        diameter = nodeSize * 2;
    for (let j = 0; j < numFoc; j++) {
        groups.push({
            id: j,
            leaves: selectedNodes[j].map((nid) => nodeMapping[nid]),
            padding: spec.padding,
            name: `foc-${j}`,
        });
        for (let nid of selectedNodes[j]) {
            coords.push({ index: nodeMapping[nid], width: diameter, height: diameter, group: j, padding });
        }
    }
    for (let h = 0; h < hops; h++) {
        groups.push({
            id: h + numFoc,
            leaves: neighArr[h].map((nid) => nodeMapping[nid]),
            padding: 5,
            name: `hop-${h + 1}`,
        });
        for (let nid of neighArr[h]) {
            coords.push({
                index: nodeMapping[nid],
                width: diameter,
                height: diameter,
                group: h + numFoc,
                padding,
            });
        }
    }
    // console.log("cola coords: ", coords);
    // console.log("cola groups: ", groups);

    const canvasSize = state.getCanvasSize(numNodes);

    const constraints = [];
    for (let j = 0; j < numFoc; j++) {
        for (let focNode of groups[j].leaves) {
            for (let hop1Node of groups[numFoc].leaves) {
                constraints.push({ axis: "x", left: focNode, right: hop1Node, gap: gapBetweenHop });
            }
        }
    }
    for (let h = 1; h <= hops - 1; h++) {
        for (let curHopNode of groups[numFoc + h - 1].leaves) {
            for (let nextHopNode of groups[numFoc + h].leaves) {
                constraints.push({ axis: "x", left: curHopNode, right: nextHopNode, gap: gapBetweenHop });
            }
        }
    }
    console.log("#constrainst = ", constraints.length);

    // for (let grp of neighGrp[0]) {
    //     for (let nodeA of grp.nodes) {
    //         // 1-hop neighbors are below selected nodes
    //         for (let nodeB of groups[0].leaves) {
    //             constraints.push({ axis: "y", left: nodeB, right: nodeA, gap: 40 });
    //         }
    //         // 1-hop neighbors are above 2-hop neighbors and others
    //         for (let nodeB of groups[2].leaves) {
    //             constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
    //         }
    //     }
    // }
    // // 2-hop neighbors are above others
    // for (let nodeA of groups[2].leaves) {
    //     for (let nodeB of groups[3].leaves) {
    //         constraints.push({ axis: "y", left: nodeA, right: nodeB, gap: 40 });
    //     }
    // }
    // // Order the groups in 1-hop neighbors from left to right
    // for (let i = 0; i < neighGrp[0].length - 1; i++) {
    //     for (let nodeA of neighGrp[0][i].nodes) {
    //         for (let nodeB of neighGrp[0][i + 1].nodes) {
    //             constraints.push({ axis: "x", left: nodeA, right: nodeB, gap: 25 });
    //         }
    //     }
    // }
    // console.log("layout constraints: ", constraints);

    function getDist(x, y) {
        const orix = reverseMapping[x],
            oriy = reverseMapping[y];
        const maskx =
                localNeighMap && localNeighMap.hasOwnProperty(orix)
                    ? localNeighMap[orix]
                    : neighborMasks[orix],
            masky =
                localNeighMap && localNeighMap.hasOwnProperty(oriy)
                    ? localNeighMap[oriy]
                    : neighborMasks[oriy];

        if (maskx && masky) {
            return getNeighborDistance(maskx, masky, distMetric);
        } else {
            return 1;
        }
    }

    let simulation = new cola()
        .size([canvasSize, canvasSize])
        .nodes(coords)
        .links(remappedEdges)
        .groups(groups)
        .defaultNodeSize(3)
        .constraints(constraints)
        // .linkDistance(15)
        .linkDistance((e) => 100 * getDist(e.source, e.target))
        // .symmetricDiffLinkLengths(2, 1)
        // .jaccardLinkLengths(50, 1)
        .avoidOverlaps(true)
        .convergenceThreshold(1e-2)
        // .start(10);
        .start(10, 15, 20);

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

    // Map node id back to the original id system
    const allCoords = new Array(numNodes);
    for (let originalId in nodeMapping) {
        if (nodeMapping.hasOwnProperty(originalId)) {
            const c = coords[nodeMapping[originalId]];
            allCoords[originalId] = { x: c.x, y: c.y };
        }
    }
    return {
        name: "WebCola",
        coords: allCoords,
        groups: groups.map((g) => ({
            id: g.id,
            bounds: { x: g.bounds.x, y: g.bounds.y, width: g.bounds.width(), height: g.bounds.height() },
            name: g.name,
        })),
        width: canvasSize,
        height: canvasSize,
        // simulation,
        // simulationTickNumber: 10,
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
