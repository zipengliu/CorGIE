import React, {Component} from 'react';
import { connect } from 'react-redux';
import {bindActionCreators} from 'redux';
import './App.css';
import {fetchGraphData} from '../actions';
import GraphView from "./GraphView";
import EmbeddingsView from "./EmbeddingsView";
import PowerSetIntersectionView from "./PowerSetIntersectionView";
import DetailView from "./DetailView";
import AdjacencyMatrix from "./AdjacencyMatrix";

class App extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //
    componentDidMount() {
        // this.props.fetchGraphData('small-10-movies');
        // this.props.fetchGraphData('medium-20-movies');
        this.props.fetchGraphData('medium-20-movies-with-ratings');
        // this.props.fetchGraphData('large-100-movies-with-ratings');
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

        const {numSelectedNodes} = this.props;
        return (
            <div>
                <div className="App">
                    <GraphView />
                    <EmbeddingsView />
                    {numSelectedNodes > 0 && <AdjacencyMatrix />}
                    {numSelectedNodes > 1 && numSelectedNodes <= this.props.powerSetLimit &&
                    <PowerSetIntersectionView />}
                </div>
                <DetailView />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loaded: state.loaded,
    error: state.error,
    numSelectedNodes: state.selectedNodes.length,
    powerSetLimit: state.powerSetLimit,
});

const mapDispatchToProps = dispatch => bindActionCreators({
    fetchGraphData
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(App);
