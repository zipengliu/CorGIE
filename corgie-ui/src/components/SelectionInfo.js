import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, DropdownButton, Button } from "react-bootstrap";
import { selectNodes, highlightNodes } from "../actions";

export class SelectionInfo extends Component {
    render() {
        const { graph, selectedNodes, highlightedNodes } = this.props;
        const { nodes, nodeTypes } = graph;
        return (
            <div className="view" id="selection-info">
                <h5 className="text-center">Selections</h5>
                <h6>Focus</h6>
                {selectedNodes.length === 0 && <div>No focal group yet.</div>}
                {selectedNodes.map((g, i) => (
                    <div className="selection-group" key={i}>
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

                <div className="section-divider"></div>
                <h6>Highlight</h6>
                <div>{highlightedNodes.length} nodes are highlighted (blinking).</div>
                {highlightedNodes.length > 0 && (
                    <div>
                        <div>Actions:</div>
                        <div>
                            <Button
                                variant="outline-primary"
                                size="xs"
                                onClick={this.props.selectNodes.bind(null, "CREATE", highlightedNodes, null)}
                            >
                                create focal group
                            </Button>
                        </div>
                        {selectedNodes.length > 0 && (
                            <div>
                                add {highlightedNodes.length === 1 ? "it" : "them"} to
                                {selectedNodes.map((_, i) => (
                                    <Button
                                        key={i}
                                        variant="outline-secondary"
                                        size="xs"
                                        onClick={this.props.selectNodes.bind(
                                            null,
                                            "APPEND",
                                            highlightedNodes,
                                            i
                                        )}
                                    >
                                        foc-{i}
                                    </Button>
                                ))}
                            </div>
                        )}
                        <div>
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                onClick={this.props.highlightNodes.bind(null, [], null, null, null)}
                            >
                                clear highlights
                            </Button>
                        </div>
                    </div>
                )}

                {/* <div className="section-divider"></div>
                <h6>Hover</h6> */}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            highlightNodes,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(SelectionInfo);
