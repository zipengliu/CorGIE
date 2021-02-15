import React, { Component } from "react";
import { connect } from "react-redux";
import { Spinner } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { isPointInBox } from "../utils";

function GraphView({ initialLayout, focalLayout }) {
    return (
        <div className="view" id="graph-view">
            <h5 className="text-center">Graph topology</h5>
            <GraphLayout layoutData={initialLayout} />
            {focalLayout.running && (
                <div>
                    <Spinner animation="border" role="status" />
                    <span style={{ marginLeft: "10px" }}>Computing layouts for selected nodes...</span>
                </div>
            )}
            {focalLayout.coords && !focalLayout.running && <GraphLayout layoutData={focalLayout} />}
        </div>
    );
}

const mapStateToProps = (state) => ({
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

export default connect(mapStateToProps)(GraphView);

class GraphView_x extends Component {
    callHighlightNodes(brushedArea) {
        const coords = this.props.focalLayout.coords;
        const targetNodes = [];
        for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            if (isPointInBox(c, brushedArea)) {
                targetNodes.push(i);
            }
        }
        if (targetNodes.length == 0) return;

        this.props.highlightNodes(targetNodes, brushedArea, "graph", null);
    }

    render() {
        return (
            // <div style={{ marginTop: "10px" }}>
            //     <h6>Distance in graph topology vs. latent space</h6>
            //     <Scatterplot xData={edges.map((e) => e.dLat)} yData={edges.map((e) => e.dTopo)} />
            // </div>

            {
                /* {focalLayout.coords && !focalLayout.running && (
                        <div>
                            <h6 className="text-center">Focal layout</h6>
                            <svg
                                width={focalLayout.width + margins.left + margins.right}
                                height={focalLayout.height + margins.top + margins.bottom}
                            >
                                <g transform={`translate(${margins.left},${margins.top})`}>
                                    <g className="edges">
                                        {edges.map((e, i) => (
                                            <line
                                                key={i}
                                                className={cn("edge", {
                                                })}
                                                x1={focalLayout.coords[e.source].x}
                                                y1={focalLayout.coords[e.source].y}
                                                x2={focalLayout.coords[e.target].x}
                                                y2={focalLayout.coords[e.target].y}
                                            />
                                        ))}
                                    </g>
                                    {focalLayout.groups && (
                                        <g className="groups">
                                            {focalLayout.groups.map((g, i) => (
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
                                        {focalLayout.coords.map((c, i) => (
                                            <g
                                                key={i}
                                                transform={`translate(${c.x},${c.y})`}
                                                className={cn("node", {
                                                    selected: isNodeSelected[i],
                                                })}
                                                style={{ fill: getNodeColor(i) }}
                                                onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                                onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                            >
                                                <NodeRep
                                                    shape={nodes[i].typeId === 0 ? "triangle" : "circle"}
                                                    r={nodes[i].typeId === 0 ? centralNodeSize : auxNodeSize}
                                                />
                                            </g>
                                        ))}
                                    </g>

                                    <Brush
                                        width={focalLayout.width}
                                        height={focalLayout.height}
                                        brushedFunc={this.callHighlightNodes.bind(this)}
                                    />
                                </g>
                            </svg>
                        </div>
                    )} */
            }
        );
    }
}
