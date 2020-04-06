import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { highlightNodeType, changeSelectedNodeType } from "../actions";

export class GlobalControls extends Component {
    render() {
        const { graph, selectedNodeType, centralNodeType } = this.props;
        const { nodes, edges, nodeTypes } = graph;

        return (
            <div id="global-controls">
                <div className="graph-info">
                    <div>
                        Number of nodes: {nodes.length}, number of edges: {edges.length}
                    </div>
                    <div>
                        <span style={{ marginLeft: "5px" }}>{nodeTypes.length} node types:</span>
                        {nodeTypes.map((nt, i) => (
                            <div
                                key={i}
                                className="node-type-legend"
                                onMouseEnter={this.props.highlightNodeType.bind(this, i)}
                                onMouseLeave={this.props.highlightNodeType.bind(this, null)}
                            >
                                <div className="emu-circle" style={{ backgroundColor: nt.color }} />
                                {nt.name}: {nt.count}
                            </div>
                        ))}
                    </div>
                    <div>
                        <span>Only select this type of node: </span>
                        <form style={{ display: "inline-block" }}>
                            <select
                                value={selectedNodeType}
                                onChange={e => {
                                    this.props.changeSelectedNodeType(e.target.value);
                                }}
                            >
                                {nodeTypes.map((nt, i) => (
                                    <option key={i} value={i}>
                                        {nt.name}
                                    </option>
                                ))}
                            </select>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state
});

const mapDispatchToProps = dispatch =>
    bindActionCreators(
        {
            highlightNodeType,
            changeSelectedNodeType
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GlobalControls);
