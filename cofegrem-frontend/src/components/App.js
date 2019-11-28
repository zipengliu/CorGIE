import React, {Component} from 'react';
import { connect } from 'react-redux';
import {bindActionCreators} from 'redux';
import './App.css';
import {fetchGraphData} from '../actions';
import GraphView from "./GraphView";
import EmbeddingsView from "./EmbeddingsView";
import SemanticSpaceView from "./SemanticSpaceView";
import DetailView from "./DetailView";

class App extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //
    componentDidMount() {
        // this.props.fetchGraphData('small-10-movies');
        // this.props.fetchGraphData('medium-20-movies');
        this.props.fetchGraphData('medium-20-movies-with-ratings');
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
                <div className="App">
                    <GraphView />
                    <EmbeddingsView />
                    <SemanticSpaceView />
                </div>
                <DetailView />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    loaded: state.loaded,
    error: state.error,
});

const mapDispatchToProps = dispatch => bindActionCreators({
    fetchGraphData
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(App);
