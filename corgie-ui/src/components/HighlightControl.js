import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, Badge } from "react-bootstrap";
import { selectNodes, highlightNodes, searchNodes, selectNodePair } from "../actions";
import NodePairList from "./NodePairList";

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
        const { selectedNodes, highlightedNodes, numHighlightsAndFocus } = this.props;
        const { selectNodes, selectNodePair, highlightNodes } = this.props;
        const areHighlightsAlsoFocus =
            highlightedNodes.length && numHighlightsAndFocus === highlightedNodes.length;

        return (
            <div className="view" id="highlight-control">
                <h5 className="view-title text-center">
                    Highlight <Badge variant="primary">{highlightedNodes.length}</Badge>
                </h5>
                <div className="view-body">
                    {/* <div>
                        <Badge variant="dark">{highlightedNodes.length}</Badge> nodes highlighted.
                    </div> */}
                    {highlightedNodes.length > 0 && (
                        <div>
                            <div>Focus on highlighted nodes:</div>
                            <div>
                                <Button
                                    variant="outline-primary"
                                    size="xs"
                                    onClick={selectNodes.bind(
                                        null,
                                        areHighlightsAlsoFocus ? "SINGLE OUT" : "CREATE",
                                        highlightedNodes,
                                        null
                                    )}
                                >
                                    {areHighlightsAlsoFocus ? "single out " : "create "}a new focal group
                                </Button>
                            </div>
                            {highlightedNodes.length === 2 && (
                                <div>
                                    <Button
                                        variant="outline-primary"
                                        size="xs"
                                        onClick={selectNodePair.bind(
                                            null,
                                            highlightedNodes[0],
                                            highlightedNodes[1]
                                        )}
                                    >
                                        remove all & create two 1-node groups
                                    </Button>
                                </div>
                            )}
                            {selectedNodes.length > 0 && !areHighlightsAlsoFocus && (
                                <div>
                                    {/* add {highlightedNodes.length === 1 ? "it" : "them"} to */}
                                    {selectedNodes.map((_, i) => (
                                        <Button
                                            key={i}
                                            variant="outline-secondary"
                                            size="xs"
                                            onClick={selectNodes.bind(null, "APPEND", highlightedNodes, i)}
                                        >
                                            add to foc-{i}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            {areHighlightsAlsoFocus && (
                                <div>
                                    <Button
                                        variant="outline-secondary"
                                        size="xs"
                                        onClick={selectNodes.bind(
                                            null,
                                            "REMOVE FROM",
                                            highlightedNodes,
                                            null
                                        )}
                                    >
                                        Remove from focus group
                                    </Button>
                                </div>
                            )}
                            <div>
                                <Button
                                    variant="outline-danger"
                                    size="xs"
                                    onClick={highlightNodes.bind(null, [], null, null, null)}
                                >
                                    clear highlights
                                </Button>
                            </div>
                        </div>
                    )}

                    <div>
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

                    <div style={{ margin: "10px 0", borderBottom: "1px solid grey" }}></div>
                    <NodePairList />
                    {numHighlightsAndFocus > 0 && !areHighlightsAlsoFocus && (
                        <div className="view-footer">
                            Note: a node can only exist in one focal group. Duplicated focal nodes will be
                            removed.
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
    numHighlightsAndFocus: state.highlightedNodes.reduce(
        (prev, cur) => prev + (state.isNodeSelected[cur] ? 1 : 0),
        0
    ),
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            highlightNodes,
            searchNodes,
            selectNodePair,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(HighlightControl);
