import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Button } from "react-bootstrap";
import { changeParam, highlightNodes } from "../actions";
import Histogram from "./Histogram";

function FeatureMatrix({ values, scale, spec }) {
    const { margins, cellSize, cellGap, barcodeMaxWidth } = spec;

    const n = values.length;
    const size = cellSize + cellGap;
    // Make a square matrix instead of a long line
    const numCols = Math.floor(barcodeMaxWidth / size);
    const numRows = Math.ceil(n / numCols);

    const width = size * numCols + margins.left + margins.right,
        height = size * numRows + margins.top + margins.bottom;

    return (
        <svg width={width} height={height} className="feature-matrix">
            <g transform={`translate(${margins.left},${margins.top})`}>
                {values.map((v, i) => (
                    <rect
                        key={i}
                        className="cell"
                        x={(i % numCols) * size}
                        y={Math.floor(i / numCols) * size}
                        width={cellSize}
                        height={cellSize}
                        fill={scale(v)}
                    >
                        <title>
                            feature index: {i} count: {v}
                        </title>
                    </rect>
                ))}
            </g>
        </svg>
    );
}

function FeatureStrips({ compressedCnts, colorScale, spec }) {
    const { barcodeHeight, margins } = spec;
    const width = compressedCnts.length + margins.left + margins.right;
    const height = barcodeHeight + margins.top + margins.bottom;

    return (
        <svg width={width} height={height} className="feature-barcode">
            <g transform={`translate(${margins.left},${margins.top})`}>
                <g>
                    {compressedCnts.map((v, i) => (
                        <line key={i} x1={i} y1={0} x2={i} y2={barcodeHeight} stroke={colorScale(v)} />
                    ))}
                </g>
                <rect
                    x={-1}
                    y={0}
                    width={compressedCnts.length + 2}
                    height={barcodeHeight}
                    style={{ strokeWidth: "1px", stroke: "grey", strokeDasharray: "5,5", fill: "None" }}
                />
            </g>
        </svg>
    );
}

function FeatureComboVis({ data, collapsed, toggleFunc, spec, legendText }) {
    const { cnts, compressedCnts, scale, mode } = data;
    // const { margins, cellSize, cellGap, barcodeMaxWidth, barcodeHeight } = spec;
    const e = scale.domain();
    const colorMin = scale(e[0]),
        colorMid = scale((e[0] + e[1]) / 2),
        colorMax = scale(e[1]);

    return (
        <div>
            <div>
                <FeatureStrips compressedCnts={compressedCnts} colorScale={scale} spec={spec} />
            </div>
            {!collapsed && (
                <div>
                    <FeatureMatrix values={cnts} mode={mode} scale={scale} spec={spec} />
                </div>
            )}
            <div style={{ marginLeft: "10px" }}>
                <span>
                    <Button variant="outline-secondary" size="xs" onClick={toggleFunc}>
                        {collapsed ? "Show" : "Hide"} feature matrix
                    </Button>
                </span>
                <span style={{ marginLeft: "15px", marginRight: "10px" }}>strip / cell color: </span>
                <span style={{ marginRight: "3px" }}>{e[0]}</span>
                <div
                    style={{
                        display: "inline-block",
                        height: "10px",
                        width: "100px",
                        background: `linear-gradient(90deg, ${colorMin} 0%, ${colorMid} 50%, ${colorMax} 100%)`,
                    }}
                ></div>
                <span style={{ marginLeft: "3px" }}>{e[1]}</span>
                <span style={{ marginLeft: "10px" }}>{legendText}</span>
            </div>
        </div>
    );
}

class NodeAttrView extends Component {
    findBrushedNodesAndDispatch(whichType, whichAttr, v1, v2) {
        const { nodes } = this.props.graph;
        const h = nodes
            .filter((n) => whichType === n.type && v1 <= n[whichAttr] && n[whichAttr] <= v2)
            .map((n) => n.id);
        this.props.highlightNodes(h, [v1, v2], "node-attr", whichAttr);
    }

    render() {
        const {
            param,
            nodeAttrs,
            selNodeAttrs,
            featureAgg,
            selFeatures,
            hoveredNodes,
            selectedNodes,
        } = this.props;
        const histSpec = this.props.spec.histogram;
        const partialHistSpec = {...histSpec, height: histSpec.height / 2};
        const { changeParam } = this.props;
        const { nodeFilter } = param;

        let hNodeData;
        if (!!hoveredNodes && hoveredNodes.length === 1) {
            hNodeData = this.props.graph.nodes[hoveredNodes[0]];
        }

        return (
            <div id="node-attr-view" className="view">
                <h5 className="text-center">Node features</h5>
                <div>
                    <div className="attribute-row">
                        <div className="attribute-row-title">All</div>
                        {nodeAttrs.map((a, i) => (
                            <div key={i} className="histogram-block">
                                <div className="title">{a.name}</div>
                                <Histogram
                                    bins={a.bins}
                                    spec={histSpec}
                                    hVal={
                                        hNodeData && hNodeData.type === a.nodeType ? hNodeData[a.name] : null
                                    }
                                    brushedFunc={this.findBrushedNodesAndDispatch.bind(
                                        this,
                                        a.nodeType,
                                        a.name
                                    )}
                                    brushedRange={
                                        nodeFilter.whichAttr === a.name ? nodeFilter.brushedArea : null
                                    }
                                />
                            </div>
                        ))}
                        {featureAgg.cnts && (
                            <FeatureComboVis
                                data={featureAgg}
                                spec={this.props.spec.feature}
                                collapsed={param.features.collapsedAll}
                                toggleFunc={changeParam.bind(this, "features.collapsedAll", null, true, null)}
                                legendText={"# nodes that have this attribute"}
                            />
                        )}
                    </div>
                    {selectedNodes.map((s, k) => (
                        <div key={k} className="attribute-row">
                            <div className="attribute-row-title">foc-{k}</div>
                            {selNodeAttrs[k].map((a, i) => (
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
                                        <Histogram bins={a.bins} spec={partialHistSpec} />
                                    )}
                                </div>
                            ))}
                            {featureAgg.cnts && (
                                <FeatureComboVis
                                    data={selFeatures[k]}
                                    spec={this.props.spec.feature}
                                    collapsed={param.features.collapsedSel[k]}
                                    toggleFunc={changeParam.bind(
                                        this,
                                        "features.collapsedSel",
                                        null,
                                        true,
                                        k
                                    )}
                                    legendText={"# nodes that have this attribute"}
                                />
                            )}
                        </div>
                    ))}
                    {selectedNodes.length === 2 && (
                        <div className="attribute-row">
                            <div className="attribute-row-title">diff.</div>
                            {featureAgg.cnts && (
                                <FeatureComboVis
                                    data={selFeatures[2]}
                                    spec={this.props.spec.feature}
                                    collapsed={param.features.collapsedSel[2]}
                                    toggleFunc={changeParam.bind(
                                        this,
                                        "features.collapsedSel",
                                        null,
                                        true,
                                        2
                                    )}
                                    legendText={"Diff. b/w two selected groups"}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam, highlightNodes }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
