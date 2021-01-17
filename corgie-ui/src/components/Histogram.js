import React from "react";
import { scaleLinear, max } from "d3";

// Render a histogram
//   bins is a data structure generated by d3 histogram()
//   spec is the specification for rendering: {margins: {left: 10, ...}, width: xxx, height: xxx}
//   xDomain (optional) is the domain of x axis.  If not specified, it will use first and last bin to compute the min and max value
//   hVal is the value to highlight in this histogram
export default function renderHistogram({ bins, spec, xDomain, xLabel, yLabel, hVal }) {
    // const yScaleMax = graph.edges.length;
    const { margins, width, height } = spec;
    const yScaleMax = max(bins.map((b) => b.length));
    const yScale = scaleLinear().domain([0, yScaleMax]).range([0, height]).nice();
    const xScale = scaleLinear()
        .domain(xDomain ? xDomain : [bins[0].x0, bins[bins.length - 1].x1])
        .range([0, width])
        .nice();
    const xTicks = xScale.ticks(3),
        xFormat = xScale.tickFormat(3, "s");
    const yTicks = yScale.ticks(4),
        yFormat = yScale.tickFormat(4, "s");

    const topMargin = margins.top + (yLabel ? 10 : 0);
    const svgWidth = margins.left + margins.right + width;
    const svgHeight = topMargin + margins.bottom + height + (xLabel ? 15 : 0);

    return (
        <svg width={svgWidth} height={svgHeight}>
            <g transform={`translate(${margins.left},${topMargin})`} className="histogram">
                {bins.map((b, i) => (
                    <rect
                        className="bar"
                        key={i}
                        x={xScale(b.x0)}
                        y={height - yScale(b.length)}
                        width={xScale(b.x1) - xScale(b.x0) - 1}
                        height={yScale(b.length)}
                    >
                        <title>
                            [{b.x0}-{b.x1}] count: {b.length}
                        </title>
                    </rect>
                ))}

                <g className="axis" transform={`translate(0,${height})`}>
                    <line x1={-3} y1={0} x2={width} y2={0} />
                    {xTicks.map((x, i) => (
                        <text key={i} x={xScale(x)} y={10} textAnchor="middle">
                            {xFormat(x)}
                        </text>
                    ))}
                    {xLabel && (
                        <text x={width} y={20} textAnchor="end">
                            {xLabel}
                        </text>
                    )}
                    {hVal && (
                        <g className="value-marker">
                            <line
                                x1={xScale(hVal)}
                                y1={15}
                                x2={xScale(hVal)}
                                y2={7}
                                markerEnd="url(#arrowhead)"
                            />
                            <text x={xScale(hVal)} y={25} textAnchor="middle">
                                {xFormat(hVal)}
                            </text>
                        </g>
                    )}
                </g>
                <g className="axis">
                    <line x1={-2} y1={height} x2={-2} y2={0} />
                    {yTicks.map((y, i) => (
                        <text key={i} x={-6} y={height - yScale(y)} textAnchor="end">
                            {yFormat(y)}
                        </text>
                    ))}
                    {yLabel && (
                        <text x={5} y={-5}>
                            {yLabel}
                        </text>
                    )}
                </g>
            </g>
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="0" refY="5" orient="auto">
                    <polygon points="0 0, 10 5, 0 10" fill="red" />
                </marker>
            </defs>
        </svg>
    );
}