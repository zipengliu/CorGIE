import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { scaleLinear, max, scaleBand } from "d3";
import { changeParam } from "../actions";

class NodeAttrView extends Component {
    render() {
        const { param, nodeAttrs } = this.props;
        const { colorBy } = param;

        const { changeParam } = this.props;

        function renderAttrFilter(a, idx) {
            const h = 80,
                w = 80,
                margin = 15,
                padding = 0.1,
                n = a.bins.length;
            let yScaleMax,
                xScale,
                yScale,
                xTicks = [];
            const xTickGap = n > 4 ? n / 4 : 1;
            if (a.type === "scalar") {
                yScaleMax = max(a.bins.map((b) => b.length));
                xScale = scaleBand()
                    .domain(a.bins.map((_, i) => i))
                    .range([0, w])
                    .round(true)
                    .padding(padding);
            } else {
                yScaleMax = max(a.bins.map((b) => b.c));
                xScale = scaleBand()
                    .domain(a.bins.map((x) => x.v))
                    .range([0, w])
                    .round(true)
                    .padding(padding);
            }
            yScale = scaleLinear().domain([0, yScaleMax]).range([0, h]);
            const yTicks = yScale.ticks(3),
                yFormat = yScale.tickFormat(3, "s");
            let cur = 0;
            while (cur < n) {
                xTicks.push(cur);
                cur += xTickGap;
            }

            return (
                <div key={idx}>
                    <div>
                        <span style={{ marginRight: "10px" }}>{a.name}</span>
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
                            <g className="axis">
                                <line x1={-2} y1={h} x2={-2} y2={0} />
                                {yTicks.map((y, i) => (
                                    <text key={i} x={-6} y={h - yScale(y)} textAnchor="end">
                                        {yFormat(y)}
                                    </text>
                                ))}
                            </g>
                        </g>
                    </svg>
                </div>
            );
        }

        return (
            <div id="node-attr-view" className="view">
                <h5 className="text-center">Nodes</h5>
                {nodeAttrs.map((a, i) => renderAttrFilter(a, i))}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
