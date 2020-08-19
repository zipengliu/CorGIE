import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, ListGroup } from "react-bootstrap";
import Slider, { Range } from "rc-slider";
import Histogram from "./Histogram";
import { changeParam, changeEdgeTypeState, selectEdge } from "../actions";
import "rc-slider/assets/index.css";

export class EdgeAttrView extends Component {
    render() {
        const {
            param,
            edgeAttributes,
            changeParam,
            spec,
            latent,
            graph,
            showEdges,
            selectedEdge,
        } = this.props;
        const { histSize, histMargins } = spec.latent;
        const { edges } = graph;
        const { edgeLenBins, edgeLen } = latent;
        const { filter } = param;
        const { edgeDistRange } = filter;
        const edgeTypes = edgeAttributes.type;
        return (
            <div id="edge-attr-view" className="view">
                <h5 className="text-center">Node pairs</h5>
                <div style={{ marginBottom: "10px" }}>
                    <h6>Node distances in latent space</h6>
                    <Histogram bins={edgeLenBins} margins={histMargins} histSize={histSize} />
                    <div
                        style={{
                            width: histSize.width,
                            marginLeft: histMargins.left,
                        }}
                    >
                        <Range
                            value={edgeDistRange}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(val) => {
                                changeParam("filter.edgeDistRange", val);
                            }}
                        />
                    </div>
                </div>

                <Form
                    onSubmit={() => {
                        console.log("submitted.");
                    }}
                >
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
                    <div>Selected edges order by dist. (asc.):</div>
                    {/* <Form.Check
                        type="switch"
                        checked={filter.ascending}
                        id="ascending"
                        label="ascending order"
                        onChange={changeParam.bind(null, "filter.ascending", null, true)}
                    /> */}
                    <div className="edge-list">
                        <ListGroup>
                            {showEdges.map((e, i) => (
                                <ListGroup.Item
                                    key={i}
                                    active={selectedEdge === e.eid}
                                    onClick={this.props.selectEdge.bind(null, e.eid)}
                                >
                                    {graph.nodes[e.source].label} - {graph.nodes[e.target].label} (w=
                                    {e.weight})
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                    <Form.Group controlId="source-node-label">
                        <Form.Label>Source node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>
                    <Form.Group controlId="target-node-label">
                        <Form.Label>Target node label</Form.Label>
                        <Form.Control as="input" size="sm"></Form.Control>
                    </Form.Group>
                    <Button type="submit">Search</Button>
                </Form>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, changeEdgeTypeState, selectEdge }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EdgeAttrView);
