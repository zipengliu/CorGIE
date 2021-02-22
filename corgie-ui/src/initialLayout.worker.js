import * as Comlink from "comlink";
import { forceSimulation, forceManyBody, forceLink, forceCenter, scaleSqrt, scaleLog, scaleLinear } from "d3";

function computeForceLayoutWithD3(numNodes, edges, margin) {
    // const constrainCoord = (v, min, max) => Math.max(min, Math.min(v, max));
    console.log("Computing initial D3 force layout...", new Date());
    let coords = new Array(numNodes).fill(false).map((_, i) => ({ index: i }));

    const maxNumNodes = 10000;
    const getSize = scaleSqrt().domain([1, maxNumNodes]).range([400, 1000]).clamp(true),
        getLinkDistance = scaleLog().base(2).domain([1, maxNumNodes]).range([50, 2]).clamp(true),
        getRepelStrength = scaleLog().base(2).domain([1, maxNumNodes]).range([-50, -1]).clamp(true);
    const canvasSize = getSize(numNodes),
        linkDist = getLinkDistance(numNodes),
        repelStrength = getRepelStrength(numNodes);

    console.log("D3 parameters: ", { canvasSize, linkDist, repelStrength, margin });

    let simulation = forceSimulation(coords)
        .force("link", forceLink(edges).distance(linkDist))
        .force("charge", forceManyBody().strength(repelStrength).distanceMin(0.2).distanceMax(100))
        .force("center", forceCenter(canvasSize / 2, canvasSize / 2))
        .stop();

    const numIterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
    for (let i = 0; i < numIterations; i++) {
        // Constrain the nodes in a bounding box
        for (let c of coords) {
            c.x = Math.max(margin, Math.min(canvasSize - margin, c.x));
            c.y = Math.max(margin, Math.min(canvasSize - margin, c.y));
        }
        simulation.tick();
    }

    console.log("Finish computing initial D3 force layout...", new Date());
    return { coords: coords.map((d) => ({ x: d.x, y: d.y })), width: canvasSize, height: canvasSize, name: 'D3 force-directed'};
}

Comlink.expose({
    computeForceLayoutWithD3: computeForceLayoutWithD3,
});
