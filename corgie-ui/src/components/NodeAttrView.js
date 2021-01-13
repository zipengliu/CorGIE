import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { changeParam, toggleHighlightNodesAttr } from "../actions";
import Histogram from "./Histogram";

class NodeAttrView extends Component {
    renderFeatureBarcode() {
        const { featureVis } = this.props;
        const spec = this.props.spec.feature;
        const { compValues, scale } = featureVis;
        const {barcodeHeight} = spec;

        const width = compValues.length;

        return (
            <svg width={width} height={barcodeHeight} className="feature-barcode">
                {compValues.map((v, i) => (
                    <line key={i} x1={i} y1={0} x2={i} y2={barcodeHeight} stroke={scale(v)} />
                ))}
            </svg>
        );
    }

    renderFeatureMatrix() {
        const { featureVis } = this.props;
        if (!featureVis.values) return;
        const spec = this.props.spec.feature;
        const { margins, cellSize, cellGap } = spec;
        const { scale } = featureVis;

        const n = featureVis.values.length;
        // Make a square matrix instead of a long line
        const m = Math.floor(Math.sqrt(n));

        const legendHeight = 20;
        const numRows = Math.ceil(n / m);
        const size = cellSize + cellGap;
        const width = size * m + margins.left + margins.right,
            height = size * numRows + legendHeight + margins.top + margins.bottom;

        return (
            <svg width={width} height={height} className="feature-matrix">
                <g transform={`translate(${margins.left},${margins.top})`}>
                    {featureVis.values.map((v, i) => (
                        <rect
                            key={i}
                            className="cell"
                            x={(i % m) * size}
                            y={Math.floor(i / m) * size}
                            width={cellSize}
                            height={cellSize}
                            fill={scale(v)}
                        >
                            <title>
                                feature index: {i} count: {v}
                            </title>
                        </rect>
                    ))}
                    <g className="legend" transform={`translate(0,${size * numRows + 10})`}>
                        <rect x={0} y={0} width={100} height={10} fill="url(#feature-color-grad)" />
                        <text x={0} y={20}>
                            0
                        </text>
                        <text x={100} y={20}>
                            {featureVis.maxVal}
                        </text>
                    </g>
                </g>
                <defs>
                    <linearGradient id="feature-color-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: scale(0), stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: scale(featureVis.maxVal), stopOpacity: 1 }} />
                    </linearGradient>
                </defs>
            </svg>
        );
    }

    render() {
        const { param, nodeAttrs, nodesToHighlight, highlightNodeAttrs, featureVis } = this.props;
        const histSpec = this.props.spec.histogram;
        const { colorBy } = param;
        const { changeParam, toggleHighlightNodesAttr } = this.props;
        const hasHighlight = nodesToHighlight && nodesToHighlight.length > 0;

        return (
            <div id="node-attr-view" className="view">
                <h5 className="text-center">Nodes</h5>
                <Button
                    size="sm"
                    variant={hasHighlight ? "primary" : "secondary"}
                    disabled={!hasHighlight}
                    onClick={toggleHighlightNodesAttr.bind(null, null)}
                >
                    Show attributes of highlighted nodes
                </Button>
                <div style={{ display: "flex" }}>
                    <div className="histogram-column">
                        {nodeAttrs.map((a, i) => (
                            <div key={i} className="histogram-block">
                                <div className="title">{a.name}</div>
                                {/* <Form.Check
                            inline
                            type="radio"
                            label="use for color"
                            checked={colorBy === i}
                            onChange={changeParam.bind(null, "colorBy", i, false)}
                        /> */}
                                <Histogram bins={a.bins} spec={histSpec} />
                            </div>
                        ))}
                    </div>
                    {highlightNodeAttrs.map((h, k) => (
                        <div key={k} className="histogram-column" style={{ border: "1px dotted grey" }}>
                            <div
                                className="histogram-close-btn"
                                onClick={toggleHighlightNodesAttr.bind(null, k)}
                            >
                                x
                            </div>
                            <div>Highlight grp {k}</div>
                            {h.attrs.map((a, i) => (
                                <div key={i} className="histogram-block">
                                    <div className="title"></div>
                                    {a.values.length === 0 ? (
                                        <div>N/A</div>
                                    ) : (
                                        <Histogram bins={a.bins} spec={histSpec} />
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                {featureVis.values && (
                    <div>
                        <h6>Binary attribute distribution</h6>
                        <div>(color: #nodes that have this attr.)</div>
                        {this.renderFeatureMatrix()}
                        <h6 style={{ marginTop: "10px" }}>Compressed barcode of matrix above</h6>
                        {this.renderFeatureBarcode()}
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    // Compute the attribute values that need to be highlighted according to state.selectedNodes
    // If there are no selection, check state.nodesToHighlight and state.isNodeHighlighted
    const hAttrNodes = [];
    if (state.selectedNodes.length == 1) {
    } else if (state.selectedNodes.length == 2) {
    } else {
        // TODO can't handle more than two selection groups for now
    }
    return { ...state };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, toggleHighlightNodesAttr }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
