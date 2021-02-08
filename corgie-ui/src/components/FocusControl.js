import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Button } from "react-bootstrap";
import { selectNodes } from "../actions";

export class FocusControl extends Component {
    render() {
        const { graph, selectedNodes } = this.props;
        const { nodes, nodeTypes } = graph;
        return (
            <div className="view" id="focus-control">
                <h5 className="text-center">Focus</h5>
                {selectedNodes.length === 0 && <div>No focal group yet.</div>}
                {selectedNodes.map((g, i) => (
                    <div className="focal-group" key={i}>
                        <span
                            className="del-btn"
                            style={{ marginRight: "5px" }}
                            onClick={this.props.selectNodes.bind(null, "DELETE", null, i)}
                        >
                            X
                        </span>
                        <span>
                            foc-{i}: {g.length} {nodeTypes.length > 1 ? nodes[g[0]].type : ""} nodes
                        </span>
                    </div>
                ))}
                {selectedNodes.length > 0 && (
                    <Button
                        variant="outline-danger"
                        size="xs"
                        onClick={this.props.selectNodes.bind(null, "CLEAR", null, null)}
                    >
                        clear focus
                    </Button>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    graph: state.graph,
    selectedNodes: state.selectedNodes,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(FocusControl);