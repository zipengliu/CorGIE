import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form } from "react-bootstrap";
import { changeParam, highlightNodePairs } from "../actions";
import Embeddings2D from "./Embeddings2D";

class EmbeddingsView extends Component {
    render() {
        const { numDim, nodeTypes, param } = this.props;

        return (
            <div id="embeddings-view" className="view">
                <h5 className="view-title text-center">
                    Latent space <small>(UMAP, #dim={numDim})</small>
                </h5>

                <div className="view-body">
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
                </div>

                <div className="view-footer">
                    Click to highlight one node. Brush to highlight a cluster.
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    return {
        numDim: emb ? emb[0].length : null,
        nodeTypes: state.graph.nodeTypes,
        param: state.param,
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
