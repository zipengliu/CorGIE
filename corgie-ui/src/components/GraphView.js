import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Spinner, ButtonGroup, Button, Form } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { changeParam, changeFocalParam } from "../actions";

export const ComputingSpinner = () => (
    <div style={{ margin: "10px" }}>
        <Spinner animation="border" role="status" size="sm" />
        <span style={{ marginLeft: "10px" }}>Computing...</span>
    </div>
);

function GraphView({
    initialLayout,
    focalLayout,
    hasFocalNodes,
    hops,
    useEdgeBundling,
    useGlobalMask,
    changeParam,
    changeFocalParam,
    focalAlg,
}) {
    return (
        <div className="view" id="graph-view">
            <h5 className="view-title text-center">Graph topology</h5>
            <div className="view-body">
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div style={{ marginRight: "10px" }}>Focal layout settings: </div>
                    <Form inline>
                        <Form.Check
                            custom
                            type="radio"
                            id="use-edge-bundling-1"
                            checked={useEdgeBundling}
                            onChange={changeFocalParam.bind(null, "focalGraph.useEdgeBundling", true)}
                            label="edge bundling (curved edges)"
                        />
                        <Form.Check
                            custom
                            type="radio"
                            id="use-edge-bundling-2"
                            checked={!useEdgeBundling}
                            onChange={changeFocalParam.bind(null, "focalGraph.useEdgeBundling", false)}
                            label="straight edges"
                        />
                    </Form>
                    {hops > 1 && <div style={{ marginRight: "20px" }}></div>}
                    {hops > 1 && (
                        <Form inline>
                            <Form.Check
                                custom
                                type="radio"
                                id="use-global-mask-1"
                                checked={useGlobalMask}
                                onChange={changeFocalParam.bind(null, "focalGraph.useGlobalMask", true)}
                                label={`use ${hops} hops to compute distance (as in GNN trainning)`}
                            />
                            <Form.Check
                                custom
                                type="radio"
                                id="use-global-mask-2"
                                checked={!useGlobalMask}
                                onChange={changeFocalParam.bind(null, "focalGraph.useGlobalMask", false)}
                                label="use 1 hop only"
                            />
                        </Form>
                    )}
                </div>
                <div
                    className="graph-layout-list"
                    style={{ minWidth: Math.max(initialLayout.width || 0, focalLayout.width || 0) + 35 }}
                >
                    {hasFocalNodes && (
                        <div
                            className="stuff-container"
                            style={{ width: focalLayout.running ? 400 : focalLayout.width + 25 }}
                        >
                            <div className="container-title">
                                Focal layout: {focalLayout.name} (V={focalLayout.numNodes}, E=
                                {focalLayout.numEdges})
                            </div>
                            <div className="container-body">
                                {focalLayout.running ? (
                                    <ComputingSpinner />
                                ) : (
                                    <GraphLayout layoutData={focalLayout} />
                                )}
                                {!!focalLayout.runningMsg && (
                                    <div style={{ margin: "10px" }}>
                                        <Spinner animation="border" role="status" size="sm" />
                                        <span style={{ marginLeft: "10px" }}>{focalLayout.runningMsg}</span>
                                    </div>
                                )}
                            </div>
                            <div className="container-footer">
                                {focalAlg === "umap" && (
                                    <div>
                                        Nodes of each group are layout using UMAP independently with the
                                        topological distance metric (Jaccard Index). Nodes outside {hops} hops
                                        are not shown.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="stuff-container">
                        <div className="container-title">
                            Original layout: {initialLayout.name} (V={initialLayout.numNodes}, E=
                            {initialLayout.numEdges})
                        </div>
                        <div className="container-body">
                            {initialLayout.running ? (
                                <ComputingSpinner />
                            ) : (
                                <GraphLayout layoutData={initialLayout} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const mapStateToProps = (state) => ({
    hasFocalNodes: state.selectedNodes.length > 0,
    hops: state.param.hops,
    focalAlg: state.param.focalGraph.layout,
    useEdgeBundling: state.param.focalGraph.useEdgeBundling,
    useGlobalMask: state.param.focalGraph.useGlobalMask,
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam, changeFocalParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
