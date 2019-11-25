import {scaleLinear, extent, deviation, forceSimulation, forceCollide} from 'd3';
import tSNE from './tsne';


const EPSILON = 1e-8;

// Input: a distance matrix
// Output: an array of coordinates (x, y)
export function runTSNE(dist) {
    let opt = {epsilon: 10, perplexity: 30, dim: 2};
    let tsne = new tSNE.tSNE(opt);
    tsne.initDataDist(dist);

    console.log('Begin tSNE');
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
    console.log('tsne iterations: ', iterations);
    for (let k = 0; k < iterations; k++) {
        tsne.step();
    }
    console.log('Finish tSNE');

    // Normalize the coordinates to (0, 1) by linear transformation
    // how much do you want to relax the extent of the coordinates so that they don't show up on the border of the dotplot
    let relaxCoefficient = 0.2;
    let coords = tsne.getSolution();
    let xArr = coords.map(x => x[0]);
    let yArr = coords.map(x => x[1]);
    let xExtent = extent(xArr);
    let xDeviation = deviation(xArr);
    let yExtent = extent(yArr);
    let yDeviation = deviation(yArr);
    xExtent[0] -= relaxCoefficient * xDeviation;
    xExtent[1] += relaxCoefficient * xDeviation;
    yExtent[0] -= relaxCoefficient * yDeviation;
    yExtent[1] += relaxCoefficient * yDeviation;

    let xScale = scaleLinear().domain(xExtent);
    let yScale = scaleLinear().domain(yExtent);

    coords = coords.map(d => ({x: xScale(d[0]), y: yScale(d[1])}));

    return coords;
}

function avoidOverlap(coords, r) {
    let nodes = coords.map((d, i) => ({...d, index: i}));
    let simulation = forceSimulation(nodes).force('collide', forceCollide(r)).stop();
    for (let i = 0; i < 100; i++) {
        simulation.tick();
    }
    return nodes.map(d => ({x: d.x, y: d.y}));
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

export function getCosineDistance(u, v) {
    let p = 0, magU = 0, magV = 0;
    for (let i = 0; i < u.length; i++) {
        p += u[i] * v[i];
        magU += Math.pow(u[i], 2);
        magV += Math.pow(v[i], 2);
    }
    let mag = Math.sqrt(magU) * Math.sqrt(magV);
    let sim = mag > EPSILON? p / mag: 1.0;
    // console.log(sim);
    return 1.0 - sim;
}