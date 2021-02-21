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

function GraphView({ initialLayout, focalLayout, hasFocalNodes }) {
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
                        <div className="container-title">Focal layout: grouped UMAP</div>
                        <div className="container-body">
                            {focalLayout.running ? (
                                <ComputingSpinner />
                            ) : (
                                <GraphLayout layoutData={focalLayout} />
                            )}
                        </div>
                        <div className="container-footer">
                            Nodes within each dotted box, except the last one, are layout using UMAP. <br />
                            Distance metric: jaccard distance between neighbor sets (two hops) of the two
                            nodes. <br />
                        </div>
                    </div>
                )}
                <div className="stuff-container">
                    <div className="container-title">Original force-directed layout</div>
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
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

export default connect(mapStateToProps)(GraphView);
