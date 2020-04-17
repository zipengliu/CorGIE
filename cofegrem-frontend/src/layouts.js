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
    linkRadial
} from "d3";
import {Layout as cola} from 'webcola';
import tSNE from "./tsne";

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
    let xArr = coords.map(x => x[0]);
    let yArr = coords.map(x => x[1]);
    let xExtent = extent(xArr);
    let yExtent = extent(yArr);

    let xScale = scaleLinear()
        .domain(xExtent)
        .range([0, w]);
    let yScale = scaleLinear()
        .domain(yExtent)
        .range([0, h]);

    return coords.map(d => ({ x: xScale(d[0]), y: yScale(d[1]) }));
}

function avoidOverlap(coords, r) {
    let nodes = coords.map((d, i) => ({ ...d, index: i }));
    let simulation = forceSimulation(nodes)
        .force("collide", forceCollide(r))
        .stop();
    for (let i = 0; i < 100; i++) {
        simulation.tick();
    }
    return nodes.map(d => ({ x: d.x, y: d.y }));
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
    for (let i = 0; i < emb.length; i++) {
        f.push(new Array(emb.length).fill(false));
    }
    for (let e of edges) {
        f[e.source][e.target] = true;
        f[e.target][e.source] = true;
    }

    let d = [];
    for (let i = 0; i < emb.length; i++) {
        // Make sure i < j to avoid duplicate computation
        for (let j = i + 1; j < emb.length; j++) {
            d.push({ i, j, d: getCosineDistance(emb[i], emb[j]), p: f[i][j] });
        }
    }
    return d;
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

    for (let i = 0; i < 300; i++) {
        simulation.tick();
    }

    return { coords: coords.map((d) => ({ x: d.x, y: d.y })), width: canvasSize, height: canvasSize };
}

export function computeForceLayoutWithCola(nodes, edges) {
    let coords = nodes.map((n, i) => ({ index: i }));
    const canvasSize = Math.ceil(Math.sqrt(nodes.length * 800));

    let simulation = (new cola())
        .size([canvasSize, canvasSize])
        .nodes(coords)
        .links(edges)
        // .avoidoverlaps(true)
        .symmetricDiffLinkLengths(2, 1)
        // .jaccardLinkLengths(15, 2)
        .start(10, 15, 20);

    for (let i = 0; i < 300; i++) {
        simulation.tick();
    }

    return { coords: coords.map((d) => ({ x: d.x, y: d.y })), width: canvasSize, height: canvasSize };
}

// Compute a circular layout with an inner ring for one central node type and outer ring for other node types
// Minimize edge-edge crossing by positioning neighbor nodes closer to the central node and edge bundling (TODO)
// TODO: host multiple central node types
export function computeCircularLayout(nodes, edges, spec, centralNodeType) {
    const centralNodes = nodes.filter(n => n.typeId === centralNodeType);
    const auxNodes = nodes.filter(n => n.typeId !== centralNodeType);
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
