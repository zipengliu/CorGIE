import React from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Spinner, ButtonGroup, Button, Form } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { changeParam } from "../actions";

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
    onlyHighlightOneNode,
    changeParam,
}) {
    return (
        <div className="view" id="graph-view">
            <h5 className="view-title text-center">Graph topology</h5>
            <div className="view-body">
                <div>
                    <span style={{ marginRight: "5px" }}>Click to highlight </span>
                    <ButtonGroup size="xs">
                        <Button
                            variant="outline-secondary"
                            active={onlyHighlightOneNode}
                            onClick={changeParam.bind(this, "onlyHighlightOneNode", true, false, null)}
                        >
                            a node
                        </Button>
                        <Button
                            variant="outline-secondary"
                            active={!onlyHighlightOneNode}
                            onClick={changeParam.bind(this, "onlyHighlightOneNode", false, false, null)}
                        >
                            a node + neighbors
                        </Button>
                    </ButtonGroup>

                    <div style={{ display: "inline-block", marginLeft: '40px' }}>
                        <Form>
                            <Form.Check
                                type="switch"
                                id="use-edge-bundling-switch"
                                checked={useEdgeBundling}
                                onChange={changeParam.bind(
                                    null,
                                    "focalGraph.useEdgeBundling",
                                    null,
                                    true,
                                    null
                                )}
                                label="use edge bundling for focal layout"
                            />
                        </Form>
                    </div>
                </div>
                {/* <div>
                    Hover: show the node and its 1-hop neighbors and hide others. <br />
                    Click: highlight the node and its 1-hop neighbors.
                </div> */}
                <div className="graph-layout-list">
                    {hasFocalNodes && (
                        <div
                            className="stuff-container"
                            style={{ width: focalLayout.running ? 400 : focalLayout.width + 25 }}
                        >
                            <div className="container-title">Focal layout: {focalLayout.name}</div>
                            <div className="container-body">
                                {focalLayout.running ? (
                                    <ComputingSpinner />
                                ) : (
                                    <GraphLayout layoutData={focalLayout} />
                                )}
                            </div>
                            <div className="container-footer">
                                Nodes of each group are layout using UMAP independently with the topological
                                distance metric (Jaccard Index). Nodes outside {hops} hops are not shown.
                            </div>
                        </div>
                    )}
                    <div className="stuff-container">
                        <div className="container-title">Original layout: {initialLayout.name}</div>
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
    useEdgeBundling: state.param.focalGraph.useEdgeBundling,
    onlyHighlightOneNode: state.param.onlyHighlightOneNode,
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({ changeParam }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
