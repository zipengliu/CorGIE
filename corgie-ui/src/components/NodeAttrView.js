import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { scaleSequential, interpolateRdBu, interpolateReds, extent, max } from "d3";
import { changeParam, toggleHighlightNodesAttr } from "../actions";
import Histogram from "./Histogram";
import { aggregateBinaryFeatures } from "../utils";

function featureMatrix(values, mode, scale, spec) {
    const { margins, cellSize, cellGap } = spec;

    const n = values.length;
    // Make a square matrix instead of a long line
    const m = Math.floor(Math.sqrt(n));
    const e = scale.domain();

    const legendHeight = 20;
    const numRows = Math.ceil(n / m);
    const size = cellSize + cellGap;
    const width = size * m + margins.left + margins.right,
        height = size * numRows + legendHeight + margins.top + margins.bottom;

    return (
        <svg width={width} height={height} className="feature-matrix">
            <g transform={`translate(${margins.left},${margins.top})`}>
                {values.map((v, i) => (
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
                    <rect x={0} y={0} width={100} height={10} fill={`url(#feature-color-grad-${mode})`} />
                    <text x={0} y={20}>
                        {e[0]}
                    </text>
                    <text x={100} y={20}>
                        {e[1]}
                    </text>
                </g>
            </g>
            <defs>
                <linearGradient id={`feature-color-grad-${mode}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: scale(e[0]), stopOpacity: 1 }} />
                    <stop offset="50%" style={{ stopColor: scale((e[1] + e[0]) / 2), stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: scale(e[1]), stopOpacity: 1 }} />
                </linearGradient>
            </defs>
        </svg>
    );
}
class NodeAttrView extends Component {
    renderFeatureBarcode() {
        const { featureVis } = this.props;
        const spec = this.props.spec.feature;
        const { compValues, scale } = featureVis;
        const { barcodeHeight } = spec;

        const width = compValues.length;

        return (
            <svg width={width} height={barcodeHeight} className="feature-barcode">
                {compValues.map((v, i) => (
                    <line key={i} x1={i} y1={0} x2={i} y2={barcodeHeight} stroke={scale(v)} />
                ))}
            </svg>
        );
    }

    render() {
        const { param, nodeAttrs, nodesToHighlight, selNodeAttrs, featureVis, hBinaryFeatures } = this.props;
        const histSpec = this.props.spec.histogram;
        const { colorBy } = param;
        const { changeParam, toggleHighlightNodesAttr } = this.props;

        let hNodeData;
        if (nodesToHighlight.length == 1) {
            hNodeData = this.props.graph.nodes[nodesToHighlight[0]];
        }

        return (
            <div id="node-attr-view" className="view">
                <h5 className="text-center">Node attributes</h5>
                {/* <Button
                    size="sm"
                    variant={hasHighlight ? "primary" : "secondary"}
                    disabled={!hasHighlight}
                    onClick={toggleHighlightNodesAttr.bind(null, null)}
                >
                    Show attributes of highlighted nodes
                </Button> */}
                <div className="histogram-row">
                    <div className="histogram-row-title">All</div>
                    {nodeAttrs.map((a, i) => (
                        <div key={i} className="histogram-block">
                            <div className="title">{a.name}</div>
                            <Histogram
                                bins={a.bins}
                                spec={histSpec}
                                hVal={hNodeData && hNodeData.type === a.nodeType ? hNodeData[a.name] : null}
                            />
                        </div>
                    ))}
                </div>
                {selNodeAttrs.map((h, k) => (
                    <div key={k} className="histogram-row">
                        {/* <div
                                className="histogram-close-btn"
                                onClick={toggleHighlightNodesAttr.bind(null, k)}
                            >
                                x
                            </div> */}
                        {/* <div>Highlight grp {k}</div> */}
                        <div className="histogram-row-title">sel-{k}</div>
                        {h.map((a, i) => (
                            <div key={i} className="histogram-block">
                                <div className="title"></div>
                                {a.values.length === 0 ? (
                                    <div
                                        style={{
                                            width:
                                                histSpec.width +
                                                histSpec.margins.left +
                                                histSpec.margins.right,
                                        }}
                                    >
                                        N/A
                                    </div>
                                ) : (
                                    <Histogram bins={a.bins} spec={histSpec} />
                                )}
                            </div>
                        ))}
                    </div>
                ))}
                {featureVis.values && (
                    <div>
                        <h6>Binary attribute distribution</h6>
                        <div>(color: #nodes that have this attr.)</div>
                        {featureMatrix(featureVis.values, "all", featureVis.scale, this.props.spec.feature)}
                        <h6 style={{ marginTop: "10px" }}>Compressed barcode of matrix above</h6>
                        {this.renderFeatureBarcode()}

                        {hBinaryFeatures.mode && (
                            <div style={{ marginTop: "10px" }}>
                                <h6>
                                    Attributes of selected nodes{" "}
                                    {hBinaryFeatures.mode == "diff" ? "(differences)" : ""}
                                </h6>
                                {featureMatrix(
                                    hBinaryFeatures.values,
                                    hBinaryFeatures.mode,
                                    hBinaryFeatures.scale,
                                    this.props.spec.feature
                                )}
                            </div>
                        )}
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
    let hBinaryFeatures = {};
    if (state.graph.features) {
        if (state.selectedNodes.length == 1) {
            hBinaryFeatures.mode = "highlight";
            hBinaryFeatures.values = aggregateBinaryFeatures(state.graph.features, state.selectedNodes[0]);
            const maxVal = max(hBinaryFeatures.values);
            hBinaryFeatures.scale = scaleSequential(interpolateReds).domain([0, maxVal]);
            console.log(hBinaryFeatures);
        } else if (state.selectedNodes.length == 2) {
            hBinaryFeatures.mode = "diff";
            hBinaryFeatures.oriValues = [
                aggregateBinaryFeatures(state.graph.features, state.selectedNodes[0]),
                aggregateBinaryFeatures(state.graph.features, state.selectedNodes[1]),
            ];
            hBinaryFeatures.values = [];
            for (let i = 0; i < hBinaryFeatures.oriValues[0].length; i++) {
                hBinaryFeatures.values.push(
                    hBinaryFeatures.oriValues[0][i] - hBinaryFeatures.oriValues[1][i]
                );
            }
            const e = extent(hBinaryFeatures.values);
            const t = Math.max(Math.abs(e[0]), Math.abs(e[1]));
            hBinaryFeatures.scale = scaleSequential(interpolateRdBu).domain([-t, t]);
            console.log(hBinaryFeatures);
        } else {
            // TODO can't handle more than two selection groups for now
        }
    }
    return { ...state, hBinaryFeatures };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, toggleHighlightNodesAttr }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
