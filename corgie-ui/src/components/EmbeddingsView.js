import React, { Component, memo } from "react";
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
import Embeddings2D from './Embeddings2D';
import Histogram from "./Histogram";


class EmbeddingsView extends Component {
    render() {
        // console.log('rendering EmbeddingView...');
        const {
            spec,
            latent,
            graph,
            param,
            selectedNodeType,
            hoveredNodes,
            focalDistances,
            highlightNodePairs,
        } = this.props;
        const histSpec = { ...spec.histogram, width: 300 };
        const { emb, isComputing, edgeLenBins } = latent;
        const { nodeTypes } = graph;
        const { nodePairFilter } = param;
        let highlightDistVal;
        if (!latent.isComputing) {
            if (!!hoveredNodes && hoveredNodes.length === 2) {
                highlightDistVal = latent.distMatrix[hoveredNodes[0]][hoveredNodes[1]];
            } else if (focalDistances !== null && !Array.isArray(focalDistances)) {
                highlightDistVal = focalDistances;
            }
        }

        return (
            <div id="embeddings-view" className="view">
                <h5 className="text-center">
                    Latent space <small>(#dim={emb[0].length})</small>
                </h5>

                <h6>UMAP 2D node embeddings</h6>
                <Embeddings2D />

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
