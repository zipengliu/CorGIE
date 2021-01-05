import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button } from "react-bootstrap";
import { changeParam, toggleHighlightNodesAttr } from "../actions";
import Histogram from "./Histogram";

class NodeAttrView extends Component {
    render() {
        const { param, nodeAttrs, nodesToHighlight, highlightNodeAttrs } = this.props;
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
                        <div>All</div>
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
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators({ changeParam, toggleHighlightNodesAttr }, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(NodeAttrView);
