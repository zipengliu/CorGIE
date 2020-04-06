import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { scaleLinear } from "d3";

class SharedCountHistogram extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const { neighborCounts, neighborCountsBins, selectedNodes, graph } = this.props;
        const { nodeTypes } = graph;
        const spec = this.props.spec.histogram;
        const { margins, barWidth, height, barGap } = spec;
        const svgHeight = height + margins.top + margins.bottom;

        let curX = 0;
        let histoXPos = [];
        for (let b of neighborCountsBins) {
            if (b.length > 0) {
                histoXPos.push(curX);
                curX += b.length * (barWidth + barGap) + margins.betweenHist;
            }
        }
        const svgWidth = margins.left + margins.right + curX;

        const yScale = scaleLinear()
            .domain([0, neighborCounts.length])
            .range([0, height]);
        console.log(neighborCountsBins);

        const xTicks = [];

        return (
            <div>
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {neighborCountsBins.map(
                            (bins, i) =>
                                bins.length > 0 && (
                                    <g key={i} transform={`translate(${histoXPos[i]},0)`}>
                                        {bins.map(
                                            (b, j) =>
                                                b.length > 0 && (
                                                    <g
                                                        key={j}
                                                        transform={`translate(${j * (barWidth + barGap) +
                                                            barGap},${height - yScale(b.length)})`}
                                                    >
                                                        <rect
                                                            style={{
                                                                stroke: "none",
                                                                fill: nodeTypes[i].color
                                                            }}
                                                            x={0}
                                                            y={0}
                                                            width={barWidth}
                                                            height={yScale(b.length)}
                                                        />
                                                        <text x={0} y={-5}>
                                                            {b.length}
                                                        </text>
                                                        <text x={0} y={yScale(b.length) + 10}>
                                                            {b[0]}
                                                        </text>
                                                    </g>
                                                )
                                        )}
                                        <g className="axis">
                                            <line
                                                x1={0}
                                                y1={height}
                                                x2={0}
                                                y2={-5}
                                                markerEnd="url(#arrow)"
                                                style={{ strokeWidth: "1px", stroke: "#000" }}
                                            />
                                        </g>
                                        <g className="axis">
                                            <line
                                                x1={0}
                                                y1={height}
                                                x2={bins.length * (barWidth + barGap)}
                                                y2={height}
                                                markerEnd="url(#arrow)"
                                                style={{ strokeWidth: "1px", stroke: "#000" }}
                                            />
                                        </g>
                                    </g>
                                )
                        )}
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({ ...state });

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(SharedCountHistogram);
