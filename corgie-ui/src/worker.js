export function getDistancesOfAllPairs(emb, edges) {
    let f = [];
    console.log('Getting distances of all node pairs...', emb.length);
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
            // TODO do I really need them or just the cosD?
            d.push({ i, j, d: cosD, p: f[i][j] });
            m[i][j] = cosD;
        }
        for (let j = 0; j < i; j++) {
            m[i][j] = m[j][i];
        }
        m[i][i] = 0;
    }

    const edgeLen = edges.map((e) => getCosineDistance(emb[e.source], emb[e.target]));

    return { distArray: d, distMatrix: m, edgeLen };
}

function getCosineDistance(u, v) {
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