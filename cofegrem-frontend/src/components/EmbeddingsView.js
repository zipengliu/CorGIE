import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Form } from "react-bootstrap";
import { highlightNodes, selectNodes, changeParam } from "../actions";
import SelectionBox from "./SelectionBox";
import NodeRep from "./NodeRep";
import { getNodeEmbeddingColor } from "../layouts";

class EmbeddingsView extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //

    render() {
        // console.log('rendering EmbeddingView...');
        const {
            spec,
            latent,
            graph,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            param,
            nodeAttrs,
        } = this.props;
        const { width, height, margins } = spec.latent;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, emb } = latent;
        const { nodes, nodeTypes } = graph;
        const { colorBy, colorScale } = param;

        // const colorScale = scaleSequential(interpolateGreens).domain([1, 0]);
        const tileNum = 100;
        const tileArr = new Array(tileNum).fill(0);

        return (
            <div id="embeddings-view" className="view">
                <h5 className="text-center">
                    Latent space <small>(#dim={emb[0].length})</small>
                </h5>

                <h6>UMAP 2D embeddings</h6>
                {/* <Form.Check
                    type="radio"
                    label="Color by position"
                    checked={colorBy === "position"}
                    onChange={this.props.changeParam.bind(null, "colorBy", "position", false)}
                /> */}
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
                        <g className="points">
                            {coords.map((c, i) => (
                                <g
                                    key={i}
                                    className={cn("point", {
                                        highlighted: isNodeHighlighted[i],
                                        selected: isNodeSelected[i],
                                        "hop-1": isNodeSelectedNeighbor[i] === 1,
                                        "hop-2": isNodeSelectedNeighbor[i] === 2,
                                    })}
                                    transform={`translate(${c.x},${c.y})`}
                                    onMouseEnter={this.props.highlightNodes.bind(this, i)}
                                    onMouseLeave={this.props.highlightNodes.bind(this, null)}
                                    onClick={this.props.selectNodes.bind(null, i)}
                                    style={{
                                        // fill: distToCurFoc ? colorScale(distToCurFoc[i]) : "grey",
                                        // fill: "grey",
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
                        <SelectionBox width={width} height={height} selectedFunc={this.props.selectNodes} />
                    </g>
                </svg>
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
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
