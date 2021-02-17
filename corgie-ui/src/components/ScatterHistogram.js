import React, { memo } from "react";
import { scaleLinear, max, interpolateGreys, scaleSequential, format } from "d3";
import Brush from "./Brush";

function ScatterHistogram({ hasHist, data, spec, xLabel, yLabel, hVals, brushedFunc, brushedArea }) {
    const { margins, histWidth, scatterWidth, legendWidth, histHeight, scatterHeight, tickLabelGap } = spec;
    const u = spec.gridBinSize,
        numBins = spec.numBins;
    const { binsLatent, binsTopo, gridBins, dist, src, tgt } = data;

    const svgWidth =
            margins.left +
            margins.right +
            (hasHist ? histWidth : 0) +
            scatterWidth +
            tickLabelGap +
            legendWidth,
        svgHeight = margins.top + margins.bottom + (hasHist ? histHeight : 0) + scatterHeight + tickLabelGap;

    // scatterplot scales
    const scatterScales = {
        latent: scaleLinear().domain([0, 1]).range([0, scatterWidth]).nice(),
        topo: scaleLinear().domain([0, 1]).range([scatterHeight, 0]).nice(),
    };
    const uLat = scatterScales.latent(u),
        uTopo = uLat;
    const colorScale = scaleSequential(interpolateGreys).domain([0, data.gridBinsMaxCnt]);
    let histScales, maxCntLatent, maxCntTopo;

    if (hasHist) {
        maxCntLatent = max(binsLatent.map((b) => b.length));
        maxCntTopo = max(binsTopo.map((b) => b.length));
        histScales = {
            latent: scaleLinear().domain([0, maxCntLatent]).range([0, histHeight]),
            topo: scaleLinear().domain([0, maxCntTopo]).range([0, histWidth]),
        };
    }
    const valFormat = format(".2f"),
        cntFormat = format(".3~s");

    const callSnapBrush = (a) => {
        function getBinIdx(x) {
            const i = Math.floor(x / u);
            return Math.min(i, numBins - 1);
        }
        const x1 = getBinIdx(scatterScales.latent.invert(a.x));
        const y2 = getBinIdx(scatterScales.topo.invert(a.y));
        const x2 = getBinIdx(scatterScales.latent.invert(a.x + a.width));
        const y1 = getBinIdx(scatterScales.topo.invert(a.y + a.height));
        let brushedPairIdx = [];
        for (let i = x1; i <= x2; i++) {
            for (let j = y1; j <= y2; j++) {
                brushedPairIdx = brushedPairIdx.concat(gridBins[i][j]);
            }
        }
        const brushedPairs = brushedPairIdx.map((p) => [dist[p], src[p], tgt[p]]);
        brushedFunc(
            {
                x: x1 * uLat,
                y: scatterHeight - y2 * uTopo,
                width: (x2 - x1 + 1) * uLat,
                height: (y2 - y1 + 1) * uTopo,
            },
            brushedPairs
        );
    };
    // const callBrushed = (x1, x2) => {
    //     const xVal1 = xScale.invert(x1),
    //         xVal2 = xScale.invert(x2);
    //     brushedFunc(xVal1, xVal2);
    // };

    const arrowLen = 8; // extra length on the axis to make arrow head
    return (
        <svg width={svgWidth} height={svgHeight} className="histogram scatterplot">
            <g transform={`translate(${margins.left},${margins.top})`}>
                <g transform={`translate(${hasHist ? histWidth + tickLabelGap : tickLabelGap},0)`}>
                    {/* scatterplot points */}
                    <g>
                        {/* {dist.map((d, i) => (
                            <circle
                                key={i}
                                className="point"
                                cx={scatterScales.latent(d[0])}
                                cy={scatterHeight - scatterScales.topo(d[1])}
                                r={2}
                                opacity={0.5}
                            />
                        ))} */}
                        {gridBins.map((row, i) => (
                            <g key={i}>
                                {row.map((col, j) => (
                                    <rect
                                        key={j}
                                        x={scatterScales.latent(i * u)}
                                        y={scatterScales.topo((j + 1) * u)}
                                        width={uLat}
                                        height={uTopo}
                                        fill={colorScale(col.length)}
                                        stroke="none"
                                    >
                                        <title>
                                            {xLabel}: {valFormat(i * u)} - {valFormat((i + 1) * u)}, {yLabel}:{" "}
                                            {valFormat(j * u)} -{valFormat((j + 1) * u)}. Count: {col.length}.
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        ))}
                    </g>
                    {/* scatterplot x-axis */}
                    <g className="axis" transform={`translate(0,${scatterHeight})`}>
                        <line
                            x1={-1}
                            y1={0}
                            x2={scatterWidth + arrowLen}
                            y2={0}
                            markerEnd="url(#axis-arrow-head)"
                        />
                        {[".5", "1"].map((x, i) => (
                            <text key={i} x={scatterScales.latent(parseFloat(x))} y={10} textAnchor="middle">
                                {x}
                            </text>
                        ))}
                        <text x={-10} y={10}>
                            0
                        </text>
                        {xLabel && (
                            <text x={scatterWidth + arrowLen} y={-5} textAnchor="end">
                                {xLabel}
                            </text>
                        )}
                    </g>
                    {/* scatterplot y-axis */}
                    <g className="axis">
                        <line
                            x1={0}
                            y1={scatterHeight}
                            x2={0}
                            y2={-arrowLen}
                            markerEnd="url(#axis-arrow-head)"
                        />
                        {[".5", "1"].map((y, i) => (
                            <text key={i} x={-3} y={scatterScales.topo(parseFloat(y))} textAnchor="end">
                                {y}
                            </text>
                        ))}
                        {yLabel && (
                            <text x={5} y={-5}>
                                {yLabel}
                            </text>
                        )}
                    </g>
                    {brushedFunc && (
                        <Brush
                            width={scatterWidth}
                            height={scatterHeight}
                            brushedFunc={callSnapBrush}
                            brushedArea={brushedArea}
                        />
                    )}
                    {hVals && (
                        <g className="value-marker">
                            <line
                                x1={0}
                                y1={scatterScales.topo(hVals[1])}
                                x2={scatterWidth + arrowLen}
                                y2={scatterScales.topo(hVals[1])}
                            />
                            <text x={2} y={scatterScales.topo(hVals[1]) - 2}>
                                {valFormat(hVals[1])}
                            </text>
                            <line
                                x1={scatterScales.latent(hVals[0])}
                                y1={0}
                                x2={scatterScales.latent(hVals[0])}
                                y2={scatterHeight}
                            />
                            <text x={scatterScales.latent(hVals[0])} y={-2} textAnchor="middle">
                                {valFormat(hVals[0])}
                            </text>
                        </g>
                    )}
                </g>

                {/* legends */}
                <g
                    className="legend"
                    transform={`translate(${
                        (hasHist ? histWidth : 0) + tickLabelGap + scatterWidth + 10
                    }, 0)`}
                >
                    <text x={uLat / 2} y={10} textAnchor="middle">
                        0
                    </text>
                    <g transform="translate(0, 12)">
                        {new Array(5).fill(0).map((_, i) => (
                            <rect
                                key={i}
                                x={0}
                                y={uTopo * i}
                                height={uLat}
                                width={uTopo}
                                fill={colorScale((i * data.gridBinsMaxCnt) / 5)}
                                stroke="black"
                            />
                        ))}
                    </g>
                    <text x={uLat / 2} y={24 + 5 * uTopo} textAnchor="middle">
                        {data.gridBinsMaxCnt}
                    </text>
                </g>

                {hasHist && (
                    <g>
                        {/* latent histogram */}
                        <g
                            transform={`translate(${histWidth + tickLabelGap},${
                                scatterHeight + tickLabelGap
                            })`}
                        >
                            <g className="axis">
                                <line
                                    x1={-1}
                                    y1={0}
                                    x2={scatterWidth + arrowLen}
                                    y2={0}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line
                                    x1={0}
                                    y1={0}
                                    x2={0}
                                    y2={histHeight + arrowLen}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line x1={0} y1={histHeight} x2={5} y2={histHeight} />
                                <text x={-2} y={histHeight} textAnchor="end">
                                    {cntFormat(maxCntLatent)}
                                </text>
                            </g>
                            <g>
                                {binsLatent.map((b, i) => (
                                    <rect
                                        className="bar"
                                        key={i}
                                        x={scatterScales.latent(b.x0)}
                                        y={0}
                                        width={uLat - 1}
                                        height={histScales.latent(b.length)}
                                    >
                                        <title>
                                            {xLabel}: {valFormat(b.x0)}-{valFormat(b.x1)} count: {b.length}
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        </g>

                        {/* topo histogram */}
                        <g transform={`translate(${histWidth}, ${scatterHeight})`}>
                            <g className="axis">
                                <line
                                    x1={1}
                                    y1={0}
                                    x2={-histWidth - arrowLen}
                                    y2={0}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line
                                    x1={0}
                                    y1={0}
                                    x2={0}
                                    y2={-scatterHeight - arrowLen}
                                    markerEnd="url(#axis-arrow-head)"
                                />
                                <line x1={-histWidth} y1={0} x2={-histWidth} y2={-5} />
                                <text x={-histWidth} y={10} textAnchor="middle">
                                    {cntFormat(maxCntTopo)}
                                </text>
                            </g>
                            <g>
                                {binsTopo.map((b, i) => (
                                    <rect
                                        className="bar"
                                        key={i}
                                        x={-histScales.topo(b.length)}
                                        y={scatterScales.topo(b.x1) - scatterHeight}
                                        width={histScales.topo(b.length)}
                                        height={uTopo - 1}
                                    >
                                        <title>
                                            {yLabel}: {valFormat(b.x0)}-{valFormat(b.x1)} count: {b.length}
                                        </title>
                                    </rect>
                                ))}
                            </g>
                        </g>
                    </g>
                )}
            </g>

            <defs>
                <marker
                    id="axis-arrow-head"
                    orient="auto"
                    markerWidth="4"
                    markerHeight="8"
                    refX="0.1"
                    refY="4"
                >
                    <path d="M0,0 V8 L4,4 Z" fill="black" />
                </marker>
            </defs>
        </svg>
    );
}

export default memo(ScatterHistogram);
