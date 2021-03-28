import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { changeParam } from "../actions";

class EmbeddingsView extends Component {
    render() {
        const { numDim, layoutData, showEdges, changeParam } = this.props;
        console.log(showEdges);

        return (
            <div id="embeddings-view" className="view">
                <h5 className="view-title text-center">
                    Latent space <small>(UMAP, #dim={numDim})</small>
                </h5>

                <div className="view-body">
                    <GraphLayout
                        layoutData={layoutData}
                        useStrokeForFocal={true}
                        fromView="emb"
                        showEdges={showEdges}
                    />
                    <Form inline>
                        <Form.Group>
                            <Form.Label>Show graph edges: </Form.Label>

                            <Form.Check
                                style={{ marginLeft: "5px" }}
                                type="radio"
                                id="emb-show-edge-none"
                                checked={!showEdges}
                                onChange={changeParam.bind(null, "embeddings.showEdges", false, null, null)}
                                label="None"
                            />
                            <Form.Check
                                style={{ marginLeft: "5px" }}
                                type="radio"
                                id="emb-show-edge-bundle"
                                checked={showEdges === "bundled"}
                                onChange={changeParam.bind(
                                    null,
                                    "embeddings.showEdges",
                                    "bundled",
                                    null,
                                    null
                                )}
                                label="bundled"
                            />
                            <Form.Check
                                style={{ marginLeft: "5px" }}
                                type="radio"
                                id="emb-show-edge-straight"
                                checked={showEdges === "straight"}
                                onChange={changeParam.bind(
                                    null,
                                    "embeddings.showEdges",
                                    "straight",
                                    null,
                                    null
                                )}
                                label="straight"
                            />
                        </Form.Group>
                    </Form>
                </div>

                <div className="view-footer">Click or brush to highlight nodes without neighbors.</div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    const spec = state.spec.latent;
    return {
        numDim: emb ? emb[0].length : null,
        showEdges: state.param.embeddings.showEdges,
        layoutData: {
            width: spec.width,
            height: spec.height,
            coords: state.latent.coords,
            edgeBundlePoints: state.latent.ebp,
            qt: state.latent.qt,
            focalBBox: state.selBoundingBox,
        },
    };
};

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
