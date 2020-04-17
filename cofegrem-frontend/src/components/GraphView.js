import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Form } from "react-bootstrap";
import { highlightNodes, selectNodes, changeParam } from "../actions";
import { max, scaleLinear } from "d3";
import NodeRep from "./NodeRep";

class GraphView extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const {
            spec,
            param,
            graph,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            neighborCounts,
            neighborCountsMapping
        } = this.props;
        const layout = param.graph.layout;
        const { width, height, margins, edgeType } = spec.graph;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, nodes, edges, nodeTypes } = graph;

        const markerScale = scaleLinear()
            .domain([0, max(neighborCounts.map(c => c.cnt)) + 1])
            .range([0, spec.graph.neighborMarkerMaxHeight]);

        return (
            <div id="graph-view" className="view">
                <h5 className="text-center">Graph space</h5>
                <div>
                    <Form inline>
                        <Form.Group controlId="graph-layout-alg">
                            <Form.Label column="sm">Graph layout:</Form.Label>
                            <Form.Control
                                as="select"
                                size="sm"
                                value={layout}
                                onChange={e => {
                                    this.props.changeParam("graph.layout", e.target.value);
                                }}
                            >
                                <option value="force-directed-d3">force-directed (D3)</option>
                                <option value="force-directed-cola">force-directed (WebCola)</option>
                                <option value="circular">circular</option>
                            </Form.Control>
                        </Form.Group>
                    </Form>
                </div>
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
                                                x1={coords[e.source].x}
                                                y1={coords[e.source].y}
                                                x2={coords[e.target].x}
                                                y2={coords[e.target].y}
                                            />
                                        )
                                    )}
                                </g>

                                <g className="nodes">
                                    {coords.map((c, i) => (
                                        <g
                                            key={i}
                                            transform={
                                                (layout === "circular" ? `rotate(${c.a})` : "") +
                                                `translate(${c.x},${c.y})`
                                            }
                                            className={cn("node", {
                                                highlighted: isNodeHighlighted[i],
                                                selected: isNodeSelected[i],
                                                "hop-1": isNodeSelectedNeighbor[i] === 1,
                                                "hop-2": isNodeSelectedNeighbor[i] === 2
                                            })}
                                            onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                            onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                            onClick={this.props.selectNodes.bind(null, i, null, true)}
                                        >
                                            <NodeRep
                                                shape={nodes[i].typeId === 0 ? "triangle" : "circle"}
                                                r={nodes[i].typeId === 0? 4: 3}
                                            />
                                            {layout === "circular" &&
                                                neighborCountsMapping &&
                                                neighborCountsMapping.hasOwnProperty(i) && (
                                                    <line
                                                        className="selected-neighbor-glyph"
                                                        x1={0}
                                                        y1={0}
                                                        x2={markerScale(neighborCountsMapping[i])}
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
            selectNodes,
            changeParam
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
