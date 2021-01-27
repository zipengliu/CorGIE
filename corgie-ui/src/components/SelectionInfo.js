import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, DropdownButton, Button } from "react-bootstrap";
import { selectNodes, changeSelectedNodeType } from "../actions";

export class SelectionInfo extends Component {
    render() {
        const { graph, selectedNodeType, selectedNodes } = this.props;
        const { nodes, nodeTypes } = graph;
        return (
            <div className="view" id="selection-info">
                <h5 className="text-center">Selections</h5>
                {nodeTypes.length > 1 && (
                    <div>
                        <Form inline>
                            <Form.Group controlId="select-node-type">
                                <Form.Label column="sm">Active type</Form.Label>
                                <Form.Control
                                    as="select"
                                    size="sm"
                                    value={selectedNodeType}
                                    onChange={(e) => {
                                        this.props.changeSelectedNodeType(e.target.value);
                                    }}
                                >
                                    {nodeTypes.map((nt, i) => (
                                        <option key={i} value={i}>
                                            {nt.name}
                                        </option>
                                    ))}
                                </Form.Control>
                            </Form.Group>
                        </Form>
                    </div>
                )}
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
                            sel-{i}: {g.length} {nodeTypes.length > 1 ? nodes[g[0]].type : ""} nodes
                        </span>
                    </div>
                ))}
                {selectedNodes.length > 0 && (
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={this.props.selectNodes.bind(null, "CLEAR", null, null)}
                    >
                        clear all
                    </Button>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            changeSelectedNodeType,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(SelectionInfo);
