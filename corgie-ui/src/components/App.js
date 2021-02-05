import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { withRouter } from "react-router-dom";
import { fetchGraphData } from "../actions";
import AppNav from "./AppNav";
import GraphView from "./GraphView";
import EmbeddingsView from "./EmbeddingsView";
// import PowerSetIntersectionView from "./PowerSetIntersectionView";
import DetailView from "./DetailView";
// import AdjacencyMatrix from "./AdjacencyMatrix";
import NodeAttrView from "./NodeAttrView";
import HighlightControl from "./HighlightControl";
import FocusControl from "./FocusControl";
import GlobalControls from "./GlobalControls";
import "./App.css";

class App extends Component {
    componentDidMount() {
        const { datasetId } = this.props.match.params;
        this.props.fetchGraphData(this.props.homePath, datasetId);
    }

    render() {
        if (!this.props.loaded) {
            return (
                <div className="App">
                    <h3>Loading data...</h3>
                    {this.props.error && <p>{this.props.error}</p>}
                </div>
            );
        }

        return (
            <div>
                <AppNav datasetId={this.props.datasetId} homePath={this.props.homePath} />

                <GlobalControls />
                <div className="App">
                    <div>
                        <FocusControl />
                        <HighlightControl />
                    </div>
                    <EmbeddingsView />
                    <div>
                        <NodeAttrView />
                        <GraphView />
                    </div>
                </div>
                <DetailView />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    homePath: state.homePath,
    datasetId: state.datasetId,
    loaded: state.loaded,
    error: state.error,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            fetchGraphData,
        },
        dispatch
    );

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App));
