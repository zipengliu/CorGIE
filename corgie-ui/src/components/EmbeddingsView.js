import React, { Component } from "react";
import { connect } from "react-redux";
import Embeddings2D from "./Embeddings2D";

class EmbeddingsView extends Component {
    render() {
        const { numDim } = this.props;

        return (
            <div id="embeddings-view" className="view">
                <h5 className="view-title text-center">
                    Latent space <small>(UMAP, #dim={numDim})</small>
                </h5>

                <div className="view-body">
                    <Embeddings2D />
                </div>

                <div className="view-footer">Click or brush to highlight nodes without neighbors.</div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    return {
        numDim: emb ? emb[0].length : null,
    };
};

export default connect(mapStateToProps)(EmbeddingsView);
