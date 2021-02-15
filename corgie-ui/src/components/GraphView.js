import React, { Component } from "react";
import { connect } from "react-redux";
import { Spinner } from "react-bootstrap";
import GraphLayout from "./GraphLayout";
import { isPointInBox } from "../utils";

function GraphView({ initialLayout, focalLayout }) {
    return (
        <div className="view" id="graph-view">
            <h5 className="text-center">Graph topology</h5>
            <GraphLayout layoutData={initialLayout} />
            {focalLayout.running && (
                <div>
                    <Spinner animation="border" role="status" />
                    <span style={{ marginLeft: "10px" }}>Computing layouts for selected nodes...</span>
                </div>
            )}
            {focalLayout.coords && !focalLayout.running && <GraphLayout layoutData={focalLayout} />}
        </div>
    );
}

const mapStateToProps = (state) => ({
    initialLayout: state.initialLayout,
    focalLayout: state.focalLayout,
});

export default connect(mapStateToProps)(GraphView);

// class GraphView_x extends Component {
//     render() {
//         return (
//             // <div style={{ marginTop: "10px" }}>
//             //     <h6>Distance in graph topology vs. latent space</h6>
//             //     <Scatterplot xData={edges.map((e) => e.dLat)} yData={edges.map((e) => e.dTopo)} />
//             // </div>
//         );
//     }
// }
