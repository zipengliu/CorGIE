import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { scaleLinear, max, scaleBand } from "d3";
import { changeParam, changeEdgeTypeState } from "../actions";

class FilterView extends Component {
    render() {
        const { param, latent, graph, edgeAttributes, nodeAttrs } = this.props;
        const { filter, colorBy } = param;
        const edgeTypes = edgeAttributes.type;

        const { changeParam } = this.props;

        function renderAttrFilter(a, idx) {
            const h = 100,
                w = 100,
                margin = 10,
                padding = 0.1;
            let yScaleMax, xScale, yScale;
            if (a.type === "scalar") {
                yScaleMax = max(a.bins.map((b) => b.length));
                yScale = scaleLinear().domain([0, yScaleMax]).range([0, h]);
                xScale = scaleBand()
                    .domain(a.bins.map((_, i) => i))
                    .range([0, w])
                    .round(true)
                    .padding(padding);
            } else {
                yScaleMax = max(a.bins.map((b) => b.c));
                yScale = scaleLinear().domain([0, yScaleMax]).range([0, h]);
                xScale = scaleBand()
                    .domain(a.bins.map((x) => x.v))
                    .range([0, w])
                    .round(true)
                    .padding(padding);
            }
            return (
                <div key={idx}>
                    <div>
                        <span style={{ marginRight: "5px" }}>{a.name}</span>
                        <Form.Check
                            inline
                            type="radio"
                            label="use for color"
                            checked={colorBy === idx}
                            onChange={changeParam.bind(null, "colorBy", idx, false)}
                        />
                    </div>
                    <svg width={w + 2 * margin} height={h + 2 * margin} className="bar-charts">
                        <g transform={`translate(${margin},${margin})`}>
                            <g>
                                {a.bins.map((b, i) =>
                                    a.type === "scalar" ? (
                                        <rect
                                            className="bar"
                                            key={i}
                                            x={xScale(i)}
                                            y={h - yScale(b.length)}
                                            width={xScale.bandwidth()}
                                            height={yScale(b.length)}
                                        >
                                            <title>
                                                {a.name}: {b.x0}-{b.x1} count: {b.length}
                                            </title>
                                        </rect>
                                    ) : (
                                        <rect
                                            className="bar"
                                            key={i}
                                            x={xScale(b.v)}
                                            y={h - yScale(b.c)}
                                            width={xScale.bandwidth()}
                                            height={yScale(b.c)}
                                            title="abc"
                                        >
                                            <title>
                                                {a.name}: {b.v} count: {b.c}
                                            </title>
                                        </rect>
                                    )
                                )}
                            </g>
                        </g>
                    </svg>
                </div>
            );
        }

        return (
            <div id="filter-view" className="view">
                <h5 className="text-center">Nodes</h5>
                {nodeAttrs.map((a, i) => renderAttrFilter(a, i))}

                <h5 className="text-center">Edges</h5>
                <Form
                    onSubmit={() => {
                        console.log("submitted.");
                    }}
                >
                    Show the following edges:
                    {edgeTypes.values.map((v, i) => (
                        <Form.Check
                            key={i}
                            type="checkbox"
                            checked={edgeTypes.show[i]}
                            id={`edge-type-${v}`}
                            label={v}
                            onChange={this.props.changeEdgeTypeState.bind(null, i)}
                        />
                    ))}
                    {/* <Form.Check
                        type="checkbox"
                        checked={filter.presentEdges}
                        id="present-edge"
                        label="present edges"
                        onChange={changeParam.bind(null, "filter.presentEdges", null, true)}
                    />
                    <Form.Check
                        type="checkbox"
                        checked={filter.absentEdges}
                        id="absent-edge"
                        label="absent edges"
                        onChange={changeParam.bind(null, "filter.absentEdges", null, true)}
                    /> */}
                    Sort edges by distance in embeddings
                    <Form.Check
                        type="switch"
                        checked={filter.ascending}
                        id="ascending"
                        label="ascending order"
                        onChange={changeParam.bind(null, "filter.ascending", null, true)}
                    />
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

const mapStateToProps = (state) => ({
    ...state,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam, changeEdgeTypeState }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(FilterView);
