import React, { Component } from "react";
import { connect } from "react-redux";

class DetailView extends Component {
    render() {
        const { nodeInfo } = this.props;
        if (!nodeInfo.length) return <div />;

        return (
            <div id="detail-view">
                {nodeInfo.map((info, i) => (
                    <p key={i}>{JSON.stringify(info)}</p>
                ))}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    nodeInfo: state.hoveredNodes.map((n) => state.graph.nodes[n]),
});

export default connect(mapStateToProps)(DetailView);
