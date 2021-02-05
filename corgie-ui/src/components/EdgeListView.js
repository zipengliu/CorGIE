// Deprecated
import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, ListGroup } from "react-bootstrap";
import { changeParam, changeEdgeTypeState, selectEdge } from "../actions";

export class EdgeListView extends Component {
    render() {
        const { param, edgeAttributes, changeParam, spec, graph, showEdges, selectedEdge } = this.props;
        const { nodes } = graph;
        const edgeTypes = edgeAttributes.type;
        return (
            <div id="edge-list-view" className="view">
                <h5 className="text-center">Highlighted node pairs</h5>

                {/* <div>Show the following edges:</div> */}
                {edgeTypes.values.map((v, i) => (
                    <Form.Check
                        inline
                        key={i}
                        type="checkbox"
                        checked={edgeTypes.show[i]}
                        id={`edge-type-${v}`}
                        label={v}
                        onChange={this.props.changeEdgeTypeState.bind(null, i)}
                    />
                ))}
                {/* <div>{showEdges.length} node pairs</div> */}
                <div>order by dist. (asc.)</div>
                {/* <Form.Check
                        type="switch"
                        checked={filter.ascending}
                        id="ascending"
                        label="ascending order"
                        onChange={changeParam.bind(null, "filter.ascending", null, true)}
                    /> */}

                <div>TODO: add controls for the edges</div>
                {/* <Form
                    onSubmit={() => {
                        console.log("submitted.");
                    }}
                >
                    <Form.Group controlId="source-node-label">
                        <Form.Label>Source node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>
                    <Form.Group controlId="target-node-label">
                        <Form.Label>Target node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>
                    <Button type="submit">Search</Button>
                </Form> */}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, changeEdgeTypeState, selectEdge }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EdgeListView);
