import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Form } from "react-bootstrap";
import { highlightNodes, selectNodes, changeParam, layoutTick } from "../actions";
import { max, scaleLinear } from "d3";
import NodeRep from "./NodeRep";
import SelectionBox from "./SelectionBox";
import { getNodeEmbeddingColor } from "../layouts";

class GraphView extends Component {
    // constructor(props) {
    //     super(props);
    // }
    componentDidUpdate() {
        const { focalGraphLayout } = this.props;

        if (focalGraphLayout.running) {
            setTimeout(() => {
                this.props.layoutTick();
            }, 10);
        }
    }

    render() {
        const {
            spec,
            param,
            graph,
            latent,
            isNodeHighlighted,
            isNodeSelected,
            selectedNodes,
            isNodeSelectedNeighbor,
            neighMap,
            focalGraphLayout,
            edgeAttributes,
        } = this.props;
        const layout = param.graph.layout;
        const focalLayout = param.focalGraph.layout;
        const { width, height, margins, edgeType, centralNodeSize, auxNodeSize } = spec.graph;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, nodes, edges } = graph;

        const edgeTypes = edgeAttributes.type;
        const showAllEdges = edgeTypes.show[0] && edgeTypes.show[1] && edgeTypes.show[2];
        let filteredEdges;
        if (showAllEdges) {
            filteredEdges = edges;
        } else {
            filteredEdges = edges.filter((e) => edgeTypes.show[e.type]);
        }

        const latentCoords = latent.coords;
        const latentWidth = spec.latent.width,
            latentHeight = spec.latent.height;

        const markerScale = scaleLinear()
            .domain([0, selectedNodes.length + 1])
            .range([0, spec.graph.neighborMarkerMaxHeight]);

        console.log("rendering graphs...");

        return (
            <div id="graph-view" className="view">
                <h5 className="text-center">Graph space</h5>

                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div>
                        <h6 className="text-center">Original graph</h6>
                        <div>
                            <Form inline>
                                <Form.Group controlId="graph-layout-alg-global">
                                    <Form.Label column="sm">Layout:</Form.Label>
                                    <Form.Control
                                        as="select"
                                        size="sm"
                                        value={layout}
                                        onChange={(e) => {
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
                        <svg width={svgWidth} height={svgHeight}>
                            <g transform={`translate(${margins.left},${margins.top})`}>
                                <g
                                    transform={
                                        layout === "circular" ? `translate(${width / 2},${height / 2})` : ""
                                    }
                                >
                                    <g className="edges">
                                        {filteredEdges.map((e, i) =>
                                            edgeType === "curve" ? (
                                                <path key={i} className="edge" d={e.curvePath} />
                                            ) : (
                                                <line
                                                    key={i}
                                                    className={cn("edge", {
                                                        highlighted:
                                                            isNodeHighlighted[e.source] &&
                                                            isNodeHighlighted[e.target],
                                                    })}
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
                                                    "hop-2": isNodeSelectedNeighbor[i] === 2,
                                                })}
                                                style={{
                                                    fill: getNodeEmbeddingColor(
                                                        latentCoords[i].x / latentWidth,
                                                        latentCoords[i].y / latentHeight
                                                    ),
                                                }}
                                                onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                                onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                                onClick={this.props.selectNodes.bind(null, i, null, true)}
                                            >
                                                <NodeRep
                                                    shape={nodes[i].typeId === 0 ? "triangle" : "circle"}
                                                    r={nodes[i].typeId === 0 ? centralNodeSize : auxNodeSize}
                                                />
                                                {layout === "circular" &&
                                                    neighMap &&
                                                    neighMap.hasOwnProperty(i) && (
                                                        <line
                                                            className="selected-neighbor-glyph"
                                                            x1={0}
                                                            y1={0}
                                                            x2={markerScale(neighMap[i])}
                                                            y2={0}
                                                        />
                                                    )}
                                            </g>
                                        ))}
                                    </g>
                                </g>
                            </g>
                        </svg>
                    </div>

                    {focalGraphLayout.coords && (
                        <div>
                            <h6 className="text-center">Local graph</h6>
                            <div>
                                <Form inline>
                                    <Form.Group controlId="graph-layout-alg-local">
                                        <Form.Label column="sm">Layout:</Form.Label>
                                        <Form.Control
                                            as="select"
                                            size="sm"
                                            value={focalLayout}
                                            onChange={(e) => {
                                                this.props.changeParam("focalGraph.layout", e.target.value);
                                            }}
                                        >
                                            <option value="force-directed-d3">force-directed (D3)</option>
                                            <option value="group-constraint-cola">
                                                group constraint (WebCola)
                                            </option>
                                            <option value="umap">umap for neighbors</option>
                                            <option value="spiral">spiral</option>
                                        </Form.Control>
                                    </Form.Group>
                                </Form>
                            </div>
                            <svg
                                width={focalGraphLayout.width + margins.left + margins.right}
                                height={focalGraphLayout.height + margins.top + margins.bottom}
                            >
                                <g transform={`translate(${margins.left},${margins.top})`}>
                                    <g className="edges">
                                        {filteredEdges.map((e, i) => (
                                            <line
                                                key={i}
                                                className={cn("edge", {
                                                    highlighted:
                                                        isNodeHighlighted[e.source] &&
                                                        isNodeHighlighted[e.target],
                                                })}
                                                x1={focalGraphLayout.coords[e.source].x}
                                                y1={focalGraphLayout.coords[e.source].y}
                                                x2={focalGraphLayout.coords[e.target].x}
                                                y2={focalGraphLayout.coords[e.target].y}
                                            />
                                        ))}
                                    </g>
                                    {focalGraphLayout.groups && (
                                        <g className="groups">
                                            {focalGraphLayout.groups.map((g, i) => (
                                                <rect
                                                    key={i}
                                                    className="node-group"
                                                    rx={5}
                                                    ry={5}
                                                    x={g.bounds.x}
                                                    y={g.bounds.y}
                                                    width={g.bounds.width || g.bounds.width()}
                                                    height={g.bounds.height || g.bounds.height()}
                                                />
                                            ))}
                                        </g>
                                    )}
                                    <g className="nodes">
                                        {focalGraphLayout.coords.map((c, i) => (
                                            <g
                                                key={i}
                                                transform={`translate(${c.x},${c.y})`}
                                                className={cn("node", {
                                                    highlighted: isNodeHighlighted[i],
                                                    selected: isNodeSelected[i],
                                                    "hop-1": isNodeSelectedNeighbor[i] === 1,
                                                    "hop-2": isNodeSelectedNeighbor[i] === 2,
                                                })}
                                                style={{
                                                    fill: getNodeEmbeddingColor(
                                                        latentCoords[i].x / latentWidth,
                                                        latentCoords[i].y / latentHeight
                                                    ),
                                                }}
                                                onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                                onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                                // onClick={this.props.selectNodes.bind(null, i, null, true)}
                                            >
                                                <NodeRep
                                                    shape={nodes[i].typeId === 0 ? "triangle" : "circle"}
                                                    r={nodes[i].typeId === 0 ? centralNodeSize : auxNodeSize}
                                                />
                                            </g>
                                        ))}
                                    </g>
                                    <text y={5}>#iterations: {focalGraphLayout.simulationTickNumber}</text>

                                    <SelectionBox
                                        width={focalGraphLayout.width}
                                        height={focalGraphLayout.height}
                                        selectedFunc={this.props.highlightNodes}
                                        selectionBoxView="focal-graph"
                                    />
                                </g>
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            selectNodes,
            changeParam,
            layoutTick,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
