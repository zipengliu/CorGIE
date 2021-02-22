import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, Badge } from "react-bootstrap";
import { selectNodes, highlightNodes, searchNodes } from "../actions";

export class HighlightControl extends Component {
    callSearch(e) {
        e.preventDefault();
        const formData = new FormData(e.target),
            { searchLabel, searchId } = Object.fromEntries(formData.entries());
        if (searchLabel) {
            this.props.searchNodes(searchLabel, null);
        } else {
            const t = parseInt(searchId);
            if (!isNaN(t)) {
                this.props.searchNodes(null, t);
            }
        }
    }
    render() {
        const { selectedNodes, highlightedNodes } = this.props;

        return (
            <div className="view" id="highlight-control">
                <h5 className="view-title text-center">Highlight</h5>
                <div className="view-body">
                    <div style={{ marginBottom: "10px" }}>
                        <div>Search nodes by</div>
                        <Form inline onSubmit={this.callSearch.bind(this)}>
                            <Form.Control
                                className="search-text-box"
                                id="search-node-label"
                                placeholder="label"
                                name="searchLabel"
                                size="sm"
                            ></Form.Control>
                            <span style={{ margin: "0 5px" }}>or</span>
                            <Form.Control
                                className="search-text-box"
                                id="search-node-id"
                                placeholder="id"
                                name="searchId"
                                size="sm"
                            ></Form.Control>
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                style={{ marginLeft: "5px" }}
                                type="submit"
                            >
                                search
                            </Button>
                        </Form>
                    </div>

                    <div>
                        <Badge variant="dark">{highlightedNodes.length}</Badge> nodes highlighted.
                    </div>
                    {highlightedNodes.length > 0 && (
                        <div>
                            {/* <div>Actions:</div> */}
                            <div>
                                <Button
                                    variant="outline-primary"
                                    size="xs"
                                    onClick={this.props.selectNodes.bind(
                                        null,
                                        "CREATE",
                                        highlightedNodes,
                                        null
                                    )}
                                >
                                    create focal group
                                </Button>
                            </div>
                            {selectedNodes.length > 0 && (
                                <div>
                                    add {highlightedNodes.length === 1 ? "it" : "them"} to
                                    {selectedNodes.map((_, i) => (
                                        <Button
                                            key={i}
                                            variant="outline-secondary"
                                            size="xs"
                                            onClick={this.props.selectNodes.bind(
                                                null,
                                                "APPEND",
                                                highlightedNodes,
                                                i
                                            )}
                                        >
                                            foc-{i}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            <div>
                                <Button
                                    variant="outline-secondary"
                                    size="xs"
                                    onClick={this.props.highlightNodes.bind(null, [], null, null, null)}
                                >
                                    clear highlights
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            highlightNodes,
            searchNodes,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(HighlightControl);
