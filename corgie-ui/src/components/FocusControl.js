import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Button, Badge } from "react-bootstrap";
import { selectNodes } from "../actions";

export class FocusControl extends Component {
    render() {
        const { selectedNodes } = this.props;
        // const { nodes, nodeTypes } = graph;
        return (
            <div className="view" id="focus-control">
                <h5 className="view-title text-center">Focus</h5>
                <div className="view-body">
                    {selectedNodes.length === 0 && (
                        <div>
                            No focal group yet. Try highlight interesting nodes (by brushing / clicking) and then create focal groups.
                        </div>
                    )}
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
                                foc-{i}: <Badge variant="dark">{g.length}</Badge> nodes
                            </span>
                        </div>
                    ))}
                    {selectedNodes.length > 0 && (
                        <Button
                            variant="outline-danger"
                            size="xs"
                            onClick={this.props.selectNodes.bind(null, "CLEAR", null, null)}
                        >
                            clear all focal nodes
                        </Button>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    // graph: state.graph,
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
