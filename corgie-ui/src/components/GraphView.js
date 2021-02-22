import React from "react";
import { connect } from "react-redux";
import { Spinner } from "react-bootstrap";
import GraphLayout from "./GraphLayout";

export const ComputingSpinner = () => (
    <div style={{ margin: "10px" }}>
        <Spinner animation="border" role="status" size="sm" />
        <span style={{ marginLeft: "10px" }}>Computing...</span>
    </div>
);

function GraphView({ initialLayout, focalLayout, hasFocalNodes, hops }) {
    return (
        <div className="view" id="graph-view">
            <h5 className="view-title text-center">Graph topology</h5>
            <div className="view-body">
                {/* <div>
                    Hover: show the node and its 1-hop neighbors and hide others. <br />
                    Click: highlight the node and its 1-hop neighbors.
                </div> */}
                {hasFocalNodes && (
                    <div className="stuff-container">
                        <div className="container-title">Focal layout: {focalLayout.name}</div>
                        <div className="container-body">
                            {focalLayout.running ? (
                                <ComputingSpinner />
                            ) : (
                                <GraphLayout layoutData={focalLayout} />
                            )}
                        </div>
                        <div className="container-footer">
                            Nodes within each box are layout using UMAP. Distance metric: jaccard distance
                            between neighbor sets ({hops} hops) of the two nodes. Nodes outside {hops} hops are
                            not shown.
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
    );
}

const mapStateToProps = (state) => ({
    hasFocalNodes: state.selectedNodes.length > 0,
    hops: state.param.hops,
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

export default connect(mapStateToProps)(GraphView);
