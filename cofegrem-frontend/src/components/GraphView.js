import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { highlightNodes, selectNodes } from "../actions";
import { max, scaleLinear } from "d3";

class GraphView extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const {
            spec,
            graph,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            neighborCounts
        } = this.props;
        const { width, height, margins, layout, edgeType } = spec.graph;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, nodes, edges, nodeTypes } = graph;

        const markerScale = scaleLinear()
            .domain([0, max(neighborCounts.map(c => c.cnt)) + 1])
            .range([0, spec.graph.neighborMarkerMaxHeight]);

        return (
            <div id="graph-view" className="view">
                {nodes.length <= 1000 && (
                    <svg width={svgWidth} height={svgHeight}>
                        <g transform={`translate(${margins.left},${margins.top})`}>
                            <g
                                transform={
                                    layout === "circular" ? `translate(${width / 2},${height / 2})` : ""
                                }
                            >
                                <g className="edges">
                                    {edges.map((e, i) =>
                                        edgeType === "curve" ? (
                                            <path key={i} className="edge" d={e.curvePath} />
                                        ) : (
                                            <line
                                                key={i}
                                                className="edge"
                                                x1={e.source.x}
                                                y1={e.source.y}
                                                x2={e.target.x}
                                                y2={e.target.y}
                                            />
                                        )
                                    )}
                                </g>

                                <g className="nodes">
                                    {coords.map((c, i) => (
                                        <g key={i} transform={layout === "circular" ? `rotate(${c.a})` : ""}>
                                            <circle
                                                className={cn("node", {
                                                    highlighted: isNodeHighlighted[i],
                                                    selected: isNodeSelected[i]
                                                })}
                                                onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                                onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                                onClick={this.props.selectNodes.bind(null, i, null, true)}
                                                cx={c.x}
                                                cy={c.y}
                                                r={c.s || 5}
                                                style={{ fill: nodeTypes[nodes[i].typeId].color }}
                                            />
                                            {layout === "circular" &&
                                                isNodeSelectedNeighbor.hasOwnProperty(i) && (
                                                    <line
                                                        className="selected-neighbor-glyph"
                                                        x1={c.x}
                                                        y1={0}
                                                        x2={c.x + markerScale(isNodeSelectedNeighbor[i])}
                                                        y2={0}
                                                    />
                                                )}
                                        </g>
                                    ))}
                                </g>
                            </g>
                        </g>
                    </svg>
                )}
            </div>
        );
    }
}

const mapStateToProps = state => ({ ...state });

const mapDispatchToProps = dispatch =>
    bindActionCreators(
        {
            highlightNodes,
            selectNodes
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
