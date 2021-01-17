import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, ListGroup } from "react-bootstrap";
import Slider, { Range } from "rc-slider";
import { scaleLinear } from "d3";
import Histogram from "./Histogram";
import { changeParam, changeEdgeTypeState, selectEdge } from "../actions";
import "rc-slider/assets/index.css";

export class EdgeAttrView extends Component {
    renderScatterplot() {
        const { edges } = this.props.graph;
        const spec = this.props.spec.histogram;
        const { margins } = spec;
        const marginTop = margins.top + 10;
        const w = 200,
            h = 200;
        const xScale = scaleLinear().domain([0, 1]).range([0, w]);
        const yScale = scaleLinear().domain([0, 1]).range([0, h]);

        const xTicks = xScale.ticks(5);
        const yTicks = yScale.ticks(5),
            yFormat = yScale.tickFormat(5, "s");

        return (
            <svg
                className="node-pair-distribution"
                width={w + margins.left + margins.right}
                height={h + marginTop + margins.bottom + 15}
            >
                <g transform={`translate(${margins.left},${marginTop})`}>
                    <g>
                        {edges.map((e, i) => (
                            <circle key={i} className="dot" r={2} cx={xScale(e.d)} cy={h - yScale(e.dNei)} />
                        ))}
                    </g>

                    <g className="axis" transform={`translate(0,${h})`}>
                        <line x1={0} y1={0} x2={w} y2={0} />
                        {xTicks.map((x, i) => (
                            <text key={i} x={xScale(x)} y={10} textAnchor="middle">
                                {x}
                            </text>
                        ))}
                        <text x={w + margins.left} y={20} textAnchor="end">
                            Cosine distance in latent space
                        </text>
                    </g>
                    <g className="axis">
                        <line x1={-2} y1={h} x2={-2} y2={0} />
                        {yTicks.map((y, i) => (
                            <text key={i} x={-6} y={h - yScale(y)} textAnchor="end">
                                {yFormat(y)}
                            </text>
                        ))}
                        <text x={5} y={-5}>
                            Jaccard distance of neighbor sets
                        </text>
                    </g>
                </g>
            </svg>
        );
    }

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
        const histSpec = { ...spec.histogram, width: 200 };
        const { nodes } = graph;
        const { edgeLenBins, edgeLen, isComputing } = latent;
        const { filter } = param;
        const { edgeDistRange } = filter;
        const edgeTypes = edgeAttributes.type;
        const labelOrId = nodes && nodes[0].label ? "label" : "id";
        return (
            <div id="edge-attr-view" className="view">
                <h5 className="text-center">Node pairs</h5>
                <div style={{ marginBottom: "10px" }}>
                    <div>
                        Distances in latent space <br />
                        (connected node pairs)
                    </div>
                    {isComputing ? (
                        <div>Computing...</div>
                    ) : (
                        <div>
                            <Histogram
                                bins={edgeLenBins}
                                spec={histSpec}
                                xDomain={[0, 1]}
                                xLabel={"Cosine distance in latent space"}
                                yLabel={"#node pairs"}
                            />
                            <div
                                style={{
                                    width: histSpec.width,
                                    marginLeft: histSpec.margins.left,
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
                    )}
                </div>

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
                <div>Selected node pairs order by dist. (asc.):</div>
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
                                {graph.nodes[e.source][labelOrId]} - {graph.nodes[e.target][labelOrId]}{" "}
                                {e.weight
                                    ? `(w=
                                ${e.weight})`
                                    : ""}
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                </div>
                <div style={{ marginTop: "10px" }}>
                    <h6>Distance in graph topology vs. latent space</h6>
                    {this.renderScatterplot()}
                </div>
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

export default connect(mapStateToProps, mapDispatchToProps)(EdgeAttrView);
