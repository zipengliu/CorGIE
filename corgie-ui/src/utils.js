
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