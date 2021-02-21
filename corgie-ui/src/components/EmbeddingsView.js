import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Spinner } from "react-bootstrap";
import { changeParam, highlightNodePairs } from "../actions";
import { ComputingSpinner } from "./GraphView";
import Embeddings2D from "./Embeddings2D";
import ScatterHistogram from "./ScatterHistogram";
import { getNeighborDistance, getCosineDistance } from "../utils";

class EmbeddingsView extends Component {
    render() {
        const {
            numDim,
            nodeTypes,
            distances,
            spec,
            param,
            highlightNodePairs,
            highlightDistVals,
            changeParam,
        } = this.props;
        const { display } = distances;
        const { nodePairFilter } = param;
        const { useLinearScale } = nodePairFilter;

        return (
            <div id="embeddings-view" className="view">
                <h5 className="view-title text-center">
                    Latent space <small>(#dim={numDim})</small>
                </h5>

                <div className="view-body">
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

                    <div>
                        <h6 style={{ marginTop: "10px" }}>
                            Compare distances of node pairs in latent vs. topo
                        </h6>
                        <div style={{ fontSize: ".875rem" }}>
                            <Form inline>
                                <Form.Label style={{ marginRight: "5px" }}>
                                    Luminance ~ #node pairs with specific distance values.
                                </Form.Label>
                                <Form.Label style={{ marginRight: "5px" }}>Choose scale type:</Form.Label>
                                <Form.Check
                                    inline
                                    label="linear"
                                    type="radio"
                                    id="scale-linear-ctrl"
                                    checked={useLinearScale}
                                    onChange={() => {
                                        changeParam("nodePairFilter.useLinearScale", null, true);
                                    }}
                                />
                                <Form.Check
                                    inline
                                    label="log10"
                                    type="radio"
                                    id="scale-log-ctrl"
                                    checked={!useLinearScale}
                                    onChange={() => {
                                        changeParam("nodePairFilter.useLinearScale", null, true);
                                    }}
                                />
                            </Form>
                        </div>
                        <div className="scatter-hist-list">
                            {display.map((d, i) => (
                                <div className="stuff-container" key={i}>
                                    <div className="container-title">{d.title}</div>
                                    <div className="container-body">
                                        {d.isComputing ? (
                                            <ComputingSpinner />
                                        ) : (
                                            <ScatterHistogram
                                                data={d}
                                                hasHist={true}
                                                useLinearScale={useLinearScale}
                                                spec={spec}
                                                xLabel="latent"
                                                yLabel="topo"
                                                hVals={highlightDistVals}
                                                brushedFunc={highlightNodePairs.bind(null, i)}
                                                brushedArea={
                                                    nodePairFilter.which === i
                                                        ? nodePairFilter.brushedArea
                                                        : null
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    const { neighborMasks } = state.graph;
    const { hoveredNodes, selectedNodes } = state;

    let highlightDistVals = null,
        hx = null,
        hy;
    if (!state.distances.display[0].isComputing) {
        if (!!hoveredNodes && hoveredNodes.length === 2) {
            hx = hoveredNodes[0];
            hy = hoveredNodes[1];
        } else if (
            selectedNodes.length === 2 &&
            selectedNodes[0].length === 1 &&
            selectedNodes[1].length === 1
        ) {
            hx = selectedNodes[0][0];
            hy = selectedNodes[1][0];
        }
        if (hx !== null) {
            highlightDistVals = [
                getCosineDistance(emb[hx], emb[hy]),
                getNeighborDistance(neighborMasks[hx], neighborMasks[hy], state.param.neighborDistanceMetric),
            ];
        }
    }

    return {
        numDim: emb ? emb[0].length : null,
        nodeTypes: state.graph.nodeTypes,
        distances: state.distances,
        spec: state.spec.scatterHist,
        param: state.param,
        hoveredNodes: state.hoveredNodes,
        selectedNodes: state.selectedNodes,
        highlightDistVals,
    };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            changeParam,
            highlightNodePairs,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
