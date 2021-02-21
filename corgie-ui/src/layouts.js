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
} from "d3";
import { Layout as cola } from "webcola";
// import tSNE from "./tsne";

// Input: a distance matrix
// Output: an array of coordinates (x, y)
// export function runTSNE(dist, spec) {
//     let opt = { epsilon: 10, perplexity: 30, dim: 2 };
//     let tsne = new tSNE.tSNE(opt);
//     tsne.initDataDist(dist);

//     console.log("Begin tSNE");
//     let iterations;
//     if (dist.length < 100) {
//         iterations = 400;
//     } else if (dist.length < 500) {
//         iterations = 300;
//     } else if (dist.length < 1000) {
//         iterations = 200;
//     } else {
//         iterations = 200;
//     }
//     console.log("tsne iterations: ", iterations);
//     for (let k = 0; k < iterations; k++) {
//         tsne.step();
//     }
//     console.log("Finish tSNE");

//     // Normalize the coordinates to (0, 1) by linear transformation
//     // how much do you want to relax the extent of the coordinates so that they don't show up on the border of the dotplot
//     // let relaxCoefficient = 0.2;
//     let coords = coordsRescale(tsne.getSolution(), spec.width, spec.height);

//     return avoidOverlap(coords, 0.1);
// }

// function avoidOverlap(coords, r) {
//     let nodes = coords.map((d, i) => ({ ...d, index: i }));
//     let simulation = forceSimulation(nodes).force("collide", forceCollide(r)).stop();
//     for (let i = 0; i < 100; i++) {
//         simulation.tick();
//     }
//     return nodes.map((d) => ({ x: d.x, y: d.y }));
// }


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
