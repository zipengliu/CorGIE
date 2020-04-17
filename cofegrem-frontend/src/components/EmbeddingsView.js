import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { highlightNodes, selectNodes } from "../actions";
import SelectionBox from "./SelectionBox";
import Histogram from "./Histogram";
import NodeRep from "./NodeRep";

class EmbeddingsView extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //

    render() {
        // console.log('rendering EmbeddingView...');
        const { spec, latent, graph, isNodeHighlighted, isNodeSelected, isNodeSelectedNeighbor } = this.props;
        const { width, height, margins, histSize } = spec.latent;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, distBinAbsent, distBinPresent, emb } = latent;
        const { nodes, nodeTypes } = graph;

        return (
            <div id="embeddings-view" className="view">
                <h5 className="text-center">
                    Latent space <small>(#dim={emb[0].length})</small>
                </h5>
                <div style={{ marginBottom: "10px" }}>
                    <h6>Node distance distribution</h6>
                    <div>present edges:</div>
                    <Histogram bins={distBinPresent} margins={margins} histSize={histSize} />

                    <div>absent edges:</div>
                    <Histogram bins={distBinAbsent} margins={margins} histSize={histSize} />
                </div>

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
                        <g className="points">
                            {coords.map((c, i) => (
                                <g
                                    key={i}
                                    className={cn("point", {
                                        highlighted: isNodeHighlighted[i],
                                        selected: isNodeSelected[i],
                                        "hop-1": isNodeSelectedNeighbor[i] === 1,
                                        "hop-2": isNodeSelectedNeighbor[i] === 2
                                    })}
                                    transform={`translate(${c.x},${c.y})`}
                                    onMouseEnter={this.props.highlightNodes.bind(this, i)}
                                    onMouseLeave={this.props.highlightNodes.bind(this, null)}
                                    onClick={this.props.selectNodes.bind(null, i)}
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

const mapStateToProps = state => ({ ...state });

const mapDispatchToProps = dispatch =>
    bindActionCreators(
        {
            highlightNodes,
            selectNodes
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
