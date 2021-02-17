import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Spinner } from "react-bootstrap";
import { changeParam, highlightNodePairs } from "../actions";
import Embeddings2D from "./Embeddings2D";
import ScatterHistogram from "./ScatterHistogram";

class EmbeddingsView extends Component {
    render() {
        const {
            numDim,
            nodeTypes,
            distances,
            spec,
            param,
            hoveredNodes,
            selectedNodes,
            highlightNodePairs,
        } = this.props;
        const { isComputing, display, distMatLatent, distMatTopo } = distances;
        const { nodePairFilter } = param;
        let highlightDistVals;
        if (!isComputing) {
            if (!!hoveredNodes && hoveredNodes.length === 2) {
                highlightDistVals = [
                    distMatLatent[hoveredNodes[0]][hoveredNodes[1]],
                    distMatTopo[hoveredNodes[0]][hoveredNodes[1]],
                ];
            } else if (
                selectedNodes.length === 2 &&
                selectedNodes[0].length === 1 &&
                selectedNodes[1].length === 1
            ) {
                highlightDistVals = [
                    distMatLatent[selectedNodes[0][0]][selectedNodes[1][0]],
                    distMatTopo[selectedNodes[0][0]][selectedNodes[1][0]],
                ];
            }
        }

        return (
            <div id="embeddings-view" className="view">
                <h5 className="text-center">
                    Latent space <small>(#dim={numDim})</small>
                </h5>

                <h6>UMAP 2D node embeddings</h6>
                <Embeddings2D />

                {nodeTypes.length > 1 && (
                    <div style={{ marginTop: "5px" }}>
                        <Form inline>
                            <Form.Group controlId="select-node-type">
                                <Form.Label column="sm">Only brush nodes of type</Form.Label>
                                <Form.Control
                                    as="select"
                                    size="xs"
                                    value={param.latent.selectedNodeType}
                                    onChange={(e) => {
                                        this.props.changeParam(
                                            "latent.selectedNodeType",
                                            parseInt(e.target.value)
                                        );
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
                    <div>
                        <Spinner animation="border" role="status" />
                        <span style={{ marginLeft: "10px" }}>Computing distances...</span>
                    </div>
                ) : (
                    <div>
                        <h6 style={{ marginTop: "10px" }}>
                            Compare distances of node pairs in latent vs. topo
                        </h6>
                        <div>
                            <small> todo: switch between linear and log scale</small>
                        </div>
                        <div className="scatter-hist-container">
                            {display.map((d, i) => (
                                <div key={i}>
                                    <div className="text-center title">
                                        {d.title}
                                    </div>
                                    <ScatterHistogram
                                        data={d}
                                        hasHist={true}
                                        spec={spec}
                                        xLabel="latent"
                                        yLabel="topo"
                                        hVals={highlightDistVals}
                                        brushedFunc={highlightNodePairs.bind(null, "all")}
                                        brushedRange={
                                            nodePairFilter.which === "all"
                                                ? nodePairFilter.brushedRange
                                                : null
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                        {/* <div>
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
                        </div> */}
                        {/* {focalDistances.length > 0 &&
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
                            ))} */}
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    numDim: state.latent.emb ? state.latent.emb[0].length : null,
    nodeTypes: state.graph.nodeTypes,
    distances: state.distances,
    spec: state.spec.scatterHist,
    param: state.param,
    hoveredNodes: state.hoveredNodes,
    selectedNodes: state.selectedNodes,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            changeParam,
            highlightNodePairs,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
