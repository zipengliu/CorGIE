import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Form } from "react-bootstrap";
import {
    highlightNodes,
    changeParam,
    changeSelectedNodeType,
    highlightNodePairs,
    hoverNode,
} from "../actions";
import Brush from "./Brush";
import NodeRep from "./NodeRep";
import { isPointInBox, getNodeEmbeddingColor } from "../utils";
import Histogram from "./Histogram";

class EmbeddingsView extends Component {
    callHighlightNodes(brushedArea) {
        const { graph, selectedNodeType } = this.props;
        const coords = this.props.latent.coords;
        const targetNodes = [];
        for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            if (graph.nodes[i].typeId === selectedNodeType && isPointInBox(c, brushedArea)) {
                targetNodes.push(i);
            }
        }
        if (targetNodes.length == 0) return;

        this.props.highlightNodes(targetNodes, brushedArea, "emb", null);
    }

    render() {
        // console.log('rendering EmbeddingView...');
        const {
            spec,
            latent,
            graph,
            isNodeHighlighted,
            isNodeSelected,
            isNodeHovered,
            param,
            nodeAttrs,
            selBoundingBox,
            selectedNodeType,
            hoveredNode,
            focalDistances,
            highlightNodePairs,
        } = this.props;
        const { width, height, margins } = spec.latent;
        const histSpec = { ...spec.histogram, width: 300 };
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, emb, isComputing, edgeLenBins } = latent;
        const { nodes, nodeTypes } = graph;
        const { colorBy, colorScale, nodePairFilter } = param;
        let highlightDistVal;
        if (!latent.isComputing) {
            if (Array.isArray(hoveredNode)) {
                highlightDistVal = latent.distMatrix[hoveredNode[0]][hoveredNode[1]];
            } else if (focalDistances !== null && !Array.isArray(focalDistances)) {
                highlightDistVal = focalDistances;
            }
        }

        // const colorScale = scaleSequential(interpolateGreens).domain([1, 0]);
        const tileNum = 100;
        const tileArr = new Array(tileNum).fill(0);

        return (
            <div id="embeddings-view" className="view">
                <h5 className="text-center">
                    Latent space <small>(#dim={emb[0].length})</small>
                </h5>

                <h6>UMAP 2D embeddings</h6>
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <rect
                            x={-margins.left / 2}
                            y={-margins.top / 2}
                            width={width + (margins.left + margins.right) / 2}
                            height={height + (margins.top + margins.bottom) / 2}
                            style={{ stroke: "#000", strokeWidth: "1px", fill: "none" }}
                        />
                        {colorBy === "position" && (
                            <g className="background-color-tiles">
                                {tileArr.map((dummyX, i) => (
                                    <g key={i}>
                                        {tileArr.map((dummyY, j) => (
                                            <rect
                                                key={j}
                                                x={(i / tileNum) * width}
                                                y={(j / tileNum) * height}
                                                width={width / tileNum}
                                                height={height / tileNum}
                                                style={{
                                                    fill: getNodeEmbeddingColor(i / tileNum, j / tileNum),
                                                }}
                                            />
                                        ))}
                                    </g>
                                ))}
                            </g>
                        )}
                        <Brush
                            width={width}
                            height={height}
                            isRange={false}
                            brushedFunc={this.callHighlightNodes.bind(this)}
                        />
                        <g className="points">
                            {coords.map((c, i) => (
                                <g
                                    key={i}
                                    className={cn("point", {
                                        highlighted: isNodeHighlighted[i],
                                        selected: isNodeSelected[i],
                                        hovered: isNodeHovered[i],
                                        nonhovered: hoveredNode !== null && !isNodeHovered[i],
                                    })}
                                    transform={`translate(${c.x},${c.y})`}
                                    onMouseEnter={this.props.hoverNode.bind(null, i)}
                                    onMouseLeave={this.props.hoverNode.bind(null, null)}
                                    // onClick={this.props.selectNodes.bind(null, i)}
                                    style={{
                                        fill:
                                            colorBy === "position"
                                                ? "grey"
                                                : nodes[i].hasOwnProperty(nodeAttrs[colorBy].name)
                                                ? colorScale(nodes[i][nodeAttrs[colorBy].name])
                                                : "grey",
                                    }}
                                >
                                    <NodeRep shape={nodes[i].typeId === 0 ? "triangle" : "circle"} r={3} />
                                    {/* <circle
                                    cx={c.x}
                                    cy={c.y}
                                    r={3}
                                    style={{ fill: nodeTypes[nodes[i].typeId].color }}
                                /> */}
                                </g>
                            ))}
                        </g>
                        <g className="bounding-box">
                            {selBoundingBox.map((h, i) => (
                                <g key={i}>
                                    <text x={h.x} y={h.y - 2}>
                                        foc-{i}
                                    </text>
                                    <rect {...h} />
                                </g>
                            ))}
                        </g>
                    </g>
                </svg>

                {nodeTypes.length > 1 && (
                    <div>
                        <Form inline>
                            <Form.Group controlId="select-node-type">
                                <Form.Label column="sm">Only brush nodes of type</Form.Label>
                                <Form.Control
                                    as="select"
                                    size="xs"
                                    value={selectedNodeType}
                                    onChange={(e) => {
                                        this.props.changeSelectedNodeType(e.target.value);
                                    }}
                                >
                                    {nodeTypes.map((nt, i) => (
                                        <option key={i} value={i}>
                                            {nt.name}
                                        </option>
                                    ))}
                                </Form.Control>
                            </Form.Group>
                        </Form>
                    </div>
                )}
                <div className="section-divider"></div>

                {isComputing ? (
                    <div>Computing distances...</div>
                ) : (
                    <div>
                        <div>
                            <h6 style={{ marginTop: "10px" }}>Distance distribution of ALL node pairs</h6>
                            <Histogram
                                bins={latent.allDistBins}
                                spec={histSpec}
                                xDomain={[0, 1]}
                                xLabel="Cosine distance"
                                yLabel="#node pairs"
                                hVal={highlightDistVal}
                                brushedFunc={highlightNodePairs.bind(null, "all")}
                                brushedRange={
                                    nodePairFilter.which === "all" ? nodePairFilter.brushedRange : null
                                }
                            />
                        </div>
                        <div>
                            <h6 style={{ marginTop: "10px" }}>of connected node pairs (aka. edges)</h6>
                            <Histogram
                                bins={edgeLenBins}
                                spec={{ ...histSpec, height: histSpec.height / 2 }}
                                xDomain={[0, 1]}
                                xLabel={"Cosine distance"}
                                yLabel={"#node pairs"}
                                brushedFunc={highlightNodePairs.bind(null, "edge")}
                                brushedRange={
                                    nodePairFilter.which === "edge" ? nodePairFilter.brushedRange : null
                                }
                            />
                        </div>
                        {focalDistances.length > 0 &&
                            focalDistances.map((hd, i) => (
                                <div key={i}>
                                    <h6>{hd.mode}</h6>
                                    <Histogram
                                        bins={hd.bins}
                                        spec={{ ...histSpec, height: histSpec.height / 2 }}
                                        xDomain={[0, 1]}
                                        xLabel="Cosine distance"
                                        yLabel="#node pairs"
                                        brushedFunc={highlightNodePairs.bind(null, i)}
                                        brushedRange={
                                            nodePairFilter.which === i ? nodePairFilter.brushedRange : null
                                        }
                                    />
                                </div>
                            ))}
                    </div>
                )}
            </div>
        );
    }
}

// TODO speed up with memorization
const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            changeParam,
            changeSelectedNodeType,
            highlightNodePairs,
            hoverNode,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
