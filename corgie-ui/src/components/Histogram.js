import React, { memo } from "react";
import { scaleLinear, max } from "d3";
import Brush from "./Brush";

// Render a histogram
//   bins is a data structure generated by d3 histogram()
//   spec is the specification for rendering: {margins: {left: 10, ...}, width: xxx, height: xxx}
//   xDomain (optional) is the domain of x axis.  If not specified, it will use first and last bin to compute the min and max value
//   hVal is the value to highlight in this histogram
function Histogram({ bins, spec, xDomain, xLabel, yLabel, hVal, brushedFunc, brushedRange }) {
    const { margins, width, height } = spec;
    const yScaleMax = max(bins.map((b) => b.length));
    const yScale = scaleLinear().domain([0, yScaleMax]).range([0, height]).nice();
    const xScale = scaleLinear()
        .domain(xDomain ? xDomain : [bins[0].x0, bins[bins.length - 1].x1])
        .range([0, width])
        .nice();
    const xTicks = xScale.ticks(3),
        xFormat = xScale.tickFormat(3, ".2~s");
    const numTicks = Math.max(1, Math.floor(height / 20));
    const yTicks = yScale.ticks(numTicks),
        yFormat = yScale.tickFormat(numTicks, ".2~s");

    const callBrushed = (x1, x2) => {
        const xVal1 = xScale.invert(x1),
            xVal2 = xScale.invert(x2);
        brushedFunc(xVal1, xVal2);
    };

    const topMargin = margins.top + (yLabel ? 10 : 0);
    const svgWidth = margins.left + margins.right + width;
    const svgHeight = topMargin + margins.bottom + height + (xLabel ? 15 : 0);

    const arrowLen = 5; // extra length on the axis to make arrow head
    return (
        <svg
            width={svgWidth}
            height={svgHeight}
            onClick={() => {
                console.log("click histo");
            }}
        >
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
                    <line x1={-3} y1={0} x2={width + arrowLen} y2={0} markerEnd="url(#axis-arrow-head)" />
                    {xTicks.map((x, i) => (
                        <g key={i} transform={`translate(${xScale(x)},0)`}>
                            <line x1={0} y1={0} x2={0} y2={4} />
                            <text x={0} y={14} textAnchor="middle">
                                {xFormat(x)}
                            </text>
                        </g>
                    ))}
                    {xLabel && (
                        <text x={width} y={20} textAnchor="end">
                            {xLabel}
                        </text>
                    )}
                </g>
                <g className="axis">
                    <line x1={-2} y1={height} x2={-2} y2={-arrowLen} markerEnd="url(#axis-arrow-head)" />
                    {yTicks.map((y, i) => (
                        <g key={i} transform={`translate(0,${height - yScale(y)})`}>
                            <line x1={-2} y1={0} x2={-6} y2={0} />
                            <text x={-10} y={3} textAnchor="end">
                                {yFormat(y)}
                            </text>
                        </g>
                    ))}
                    {yLabel && (
                        <text x={5} y={-5}>
                            {yLabel}
                        </text>
                    )}
                </g>
                {hVal && (
                    <g className="value-marker" transform={`translate(${xScale(hVal)},0)`}>
                        <line x1={0} y1={0} x2={0} y2={height} />
                        <rect x={-25} y={-10} width={50} height={18} />
                        <text x={0} y={3} textAnchor="middle">
                            {xFormat(hVal)}
                        </text>
                    </g>
                )}

                {brushedFunc && (
                    <Brush
                        width={width}
                        height={height}
                        isRange={true}
                        brushedFunc={callBrushed}
                        brushedArea={
                            brushedRange
                                ? {
                                      x: xScale(brushedRange[0]),
                                      y: 0,
                                      width: xScale(brushedRange[1]) - xScale(brushedRange[0]),
                                      height: height,
                                  }
                                : null
                        }
                    />
                )}
            </g>
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="0" refY="5" orient="auto">
                    <polygon points="0 0, 10 5, 0 10" fill="black" />
                </marker>
                <marker id="arrowhead-big" markerWidth="12" markerHeight="12" refX="0" refY="6" orient="auto">
                    <polygon points="0 0, 12 6, 0 12" fill="black" />
                </marker>
            </defs>
        </svg>
    );
}

export default memo(Histogram);
