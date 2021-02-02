import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";

class DetailView extends Component {
    render() {
        const { nodeInfo } = this.props;
        if (nodeInfo === null) return <div />;

        return <div id="detail-view">{JSON.stringify(nodeInfo)}</div>;
    }
}

const mapStateToProps = state => ({
    nodeInfo: state.hoveredNode !== null ? state.graph.nodes[state.hoveredNode] : null
});

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(DetailView);
