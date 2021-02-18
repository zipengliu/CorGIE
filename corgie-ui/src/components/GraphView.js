import React from "react";
import { connect } from "react-redux";
import { Spinner } from "react-bootstrap";
import GraphLayout from "./GraphLayout";

function GraphView({ initialLayout, focalLayout }) {
    return (
        <div className="view" id="graph-view">
            <h5 className="text-center">Graph topology</h5>
            {focalLayout.running && (
                <div>
                    <Spinner animation="border" role="status" />
                    <span style={{ marginLeft: "10px" }}>Computing layouts for selected nodes...</span>
                </div>
            )}
            {focalLayout.coords && !focalLayout.running && <GraphLayout layoutData={focalLayout} />}
            <GraphLayout layoutData={initialLayout} />
        </div>
    );
}

const mapStateToProps = (state) => ({
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

export default connect(mapStateToProps)(GraphView);
