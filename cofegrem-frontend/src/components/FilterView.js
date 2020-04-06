import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form } from "react-bootstrap";
import { scaleLinear, max } from "d3";
import { changeFilter } from "../actions";

function renderHistogram(bins, margins, histSize) {
    // const yScaleMax = graph.edges.length;
    const yScaleMax = max(bins.map(b => b.length));
    const yScale = scaleLinear()
        .domain([0, yScaleMax])
        .range([0, histSize.height]);
    const xScale = scaleLinear()
        .domain([0, 1])
        .range([0, histSize.width]);
    const xTicks = xScale.ticks(5);
    const yTicks = yScale.ticks(5),
        yFormat = yScale.tickFormat(5, "s");

    const svgWidth = margins.left + margins.right + histSize.width;
    const svgHeight = margins.left + margins.right + histSize.height;

    return (
        <svg width={svgWidth} height={svgHeight}>
            <g transform={`translate(${margins.left},${margins.top})`} className="histogram">
                {bins.map((bin, i) => (
                    <rect
                        className="bar"
                        key={i}
                        x={xScale(bin.x0)}
                        y={histSize.height - yScale(bin.length)}
                        width={xScale(bin.x1 - bin.x0) - 1}
                        height={yScale(bin.length)}
                    />
                ))}

                <g className="axis" transform={`translate(0,${histSize.height})`}>
                    <line x1={0} y1={0} x2={histSize.width} y2={0} />
                    {xTicks.map((x, i) => (
                        <text key={i} x={xScale(x)} y={10} textAnchor="middle">
                            {x}
                        </text>
                    ))}
                </g>
                <g className="axis">
                    <line x1={0} y1={histSize.height} x2={0} y2={0} />
                    {yTicks.map((y, i) => (
                        <text key={i} x={-6} y={histSize.height - yScale(y)} textAnchor="end">
                            {yFormat(y)}
                        </text>
                    ))}
                </g>
            </g>
        </svg>
    );
}

class FilterView extends Component {
    render() {
        const { filters, latent, graph } = this.props;
        const { distBinPresent, distBinAbsent } = latent;
        const spec = this.props.spec.latent;
        const { histSize } = spec;
        const { margins } = this.props.spec.histogram;

        const { changeFilter } = this.props;

        return (
            <div id="filter-view" className="view">
                <h5>Node distance distribution in latent space</h5>
                <div>present edges:</div>
                <div>{renderHistogram(distBinPresent, margins, histSize)}</div>

                <div>absent edges:</div>
                <div>{renderHistogram(distBinAbsent, margins, histSize)}</div>

                <h5>Edge list</h5>
                <Form>
                    <Form.Check
                        type="checkbox"
                        checked={filters.presentEdges}
                        id="present-edge"
                        label="present edges"
                        onChange={changeFilter.bind(null, "presentEdges", null, true)}
                    />
                    <Form.Check
                        type="checkbox"
                        checked={filters.absentEdges}
                        id="absent-edge"
                        label="absent edges"
                        onChange={changeFilter.bind(null, "absentEdges", null, true)}
                    />

                    <Form.Check
                        type="switch"
                        checked={filters.ascending}
                        id="ascending"
                        label="ascending order"
                        onChange={changeFilter.bind(null, "ascending", null, true)}
                    />

                    <div>source node:</div>
                    <input type="text" />
                    <div>target node:</div>
                    <input type="text" />
                </Form>

                <div className="edge-list"></div>
                <div>TODO</div>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state
});

const mapDispatchToProps = dispatch => bindActionCreators({ changeFilter }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(FilterView);
