import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { Form } from "react-bootstrap";
import { highlightNodes, selectNodes, changeParam } from "../actions";
import SelectionBox from "./SelectionBox";
import NodeRep from "./NodeRep";
import { getNodeEmbeddingColor } from "../layouts";
import Histogram from "./Histogram";

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
            highlightDist,
        } = this.props;
        const { width, height, margins } = spec.latent;
        const histSpec = { ...spec.histogram, width: 300 };
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const { coords, emb, isComputing } = latent;
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
                                hVal={this.props.highlightDistSingle}
                            />
                        </div>
                        {highlightDist.map((hd, i) => (
                            <div key={i}>
                                <h6>{hd.mode}</h6>
                                <Histogram
                                    bins={hd.bins}
                                    spec={{ ...histSpec, height: histSpec.height / 2 }}
                                    xDomain={[0, 1]}
                                    xLabel="Cosine distance"
                                    yLabel="#node pairs"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
}

const getIntraDistances = (nodes, distMatrix) => {
    const n = nodes.length;
    const d = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            d.push(distMatrix[nodes[i]][nodes[j]]);
        }
    }
    return d;
};

// TODO speed up with memorization
const mapStateToProps = (state) => {
    const highlightDist = [];
    let highlightDistSingle;
    const { selectedNodes } = state;
    if (!state.latent.isComputing) {
        if (selectedNodes.length == 1 && selectedNodes[0].length > 1) {
            const d = {
                mode: "witin selected",
                values: getIntraDistances(selectedNodes[0], state.latent.distMatrix),
            };
            d.bins = state.latent.binGen(d.values);
            highlightDist.push(d);
        } else if (selectedNodes.length > 1) {
            for (let k = 0; k < selectedNodes.length; k++) {
                if (selectedNodes[k].length > 1) {
                    const d = {
                        mode: `within selected group ${k}`,
                        values: getIntraDistances(selectedNodes[k], state.latent.distMatrix),
                    };
                    d.bins = state.latent.binGen(d.values);
                    highlightDist.push(d);
                }
            }
            if (selectedNodes.length == 2) {
                const n1 = selectedNodes[0].length,
                    n2 = selectedNodes[1].length;
                if (n1 > 1 || n2 > 1) {
                    const d2 = { mode: "between two selected groups", values: [] };
                    for (let i = 0; i < n1; i++) {
                        for (let j = 0; j < n2; j++) {
                            d2.values.push(state.latent.distMatrix[selectedNodes[0][i]][selectedNodes[1][j]]);
                        }
                    }
                    d2.bins = state.latent.binGen(d2.values);
                    highlightDist.push(d2);
                } else if (n1 == 1 && n2 == 1) {
                    highlightDistSingle = state.latent.distMatrix[selectedNodes[0][0]][selectedNodes[1][0]];
                }
            }
        }
    }
    console.log({ highlightDist, highlightDistSingle });
    return { ...state, highlightDist, highlightDistSingle };
};

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
