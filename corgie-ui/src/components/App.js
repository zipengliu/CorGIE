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
import SettingsView from "./SettingsView";
import DistanceView from "./DistanceView";
import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.appRef = React.createRef();
        this.leftColRef = React.createRef();
        this.state = { rightWidth: null };
        this.bindedUpdate = this.updateDimensions.bind(this);
    }
    updateDimensions() {
        if (this.props.loaded) {
            const bboxParent = this.appRef.current.getBoundingClientRect(),
                bboxLeft = this.leftColRef.current.getBoundingClientRect();
            this.setState({ rightWidth: bboxParent.width - bboxLeft.width - 10 });
        }
    }
    componentDidMount() {
        const { datasetId } = this.props.match.params;
        window.addEventListener("resize", this.bindedUpdate);
        this.props.fetchGraphData(this.props.homePath, datasetId);
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.bindedUpdate);
    }
    componentDidUpdate() {
        if (this.props.loaded && !this.state.rightWidth) {
            this.updateDimensions();
        }
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
        const { numNodes, numEdges, homePath, datasetId, hasNodeFeatures } = this.props;
        const { rightWidth } = this.state;

        return (
            <div>
                <AppNav datasetId={datasetId} homePath={homePath} stats={{ numNodes, numEdges }} />

                <div className="App" ref={this.appRef}>
                    <div ref={this.leftColRef} style={{ flexShrink: 2 }}>
                        <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end" }}>
                            <div>
                                <FocusControl />
                                <HighlightControl />
                            </div>
                            <div>
                                <SettingsView />
                                <EmbeddingsView />
                            </div>
                        </div>
                        <div>
                            <DistanceView />
                        </div>
                    </div>
                    <div style={{ maxWidth: rightWidth ? rightWidth + "px" : "auto" }}>
                        {hasNodeFeatures && <NodeAttrView />}
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
    numNodes: state.loaded ? state.graph.nodes.length : 0,
    numEdges: state.loaded ? state.graph.edges.length : 0,
    hasNodeFeatures: state.loaded && (state.nodeAttrs.active || state.featureAgg.active),
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
