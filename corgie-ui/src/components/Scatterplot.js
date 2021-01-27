import React, { Component } from "react";
import { connect } from "react-redux";
import { scaleLinear } from "d3";

export class Scatterplot extends Component {
    render() {
        const { xData, yData } = this.props;
        const spec = this.props.spec.scatterplot;
        const { margins, width, height } = spec;
        const xScale = scaleLinear().domain([0, 1]).range([0, width]);
        const yScale = scaleLinear().domain([0, 1]).range([0, height]);
        const xTicks = xScale.ticks(5);
        const yTicks = yScale.ticks(5),
            yFormat = yScale.tickFormat(5, "s");

        return (
            <svg
                className="scatterplot"
                width={width + margins.left + margins.right}
                height={height + margins.top + margins.bottom}
            >
                <g transform={`translate(${margins.left},${margins.top})`}>
                    <g>
                        {xData.map((x, i) => (
                            <circle
                                key={i}
                                className="dot"
                                r={2}
                                cx={xScale(x)}
                                cy={height - yScale(yData[i])}
                            />
                        ))}
                    </g>

                    <g className="axis" transform={`translate(0,${height})`}>
                        <line x1={0} y1={0} x2={width} y2={0} />
                        {xTicks.map((x, i) => (
                            <text key={i} x={xScale(x)} y={10} textAnchor="middle">
                                {x}
                            </text>
                        ))}
                        <text x={width} y={20} textAnchor="end">
                            Cosine distance in latent space
                        </text>
                    </g>
                    <g className="axis">
                        <line x1={-2} y1={height} x2={-2} y2={0} />
                        {yTicks.map((y, i) => (
                            <text key={i} x={-6} y={height - yScale(y)} textAnchor="end">
                                {yFormat(y)}
                            </text>
                        ))}
                        <text x={5} y={-5}>
                            Jaccard distance of topo neighbor sets
                        </text>
                    </g>
                </g>
            </svg>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = {};

export default connect(mapStateToProps, mapDispatchToProps)(Scatterplot);
