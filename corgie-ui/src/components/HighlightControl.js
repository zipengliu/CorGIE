import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Button, Badge } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretRight, faCaretDown } from "@fortawesome/free-solid-svg-icons";
import {
    selectNodes,
    highlightNodes,
    searchNodes,
    selectNodePair,
    changeParam,
    highlightNodePairs,
} from "../actions";

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
        const { selectedNodes, highlightedNodes, numHighlightsAndFocus, searchShown } = this.props;
        const { unseenTopK, hasLinkPredictions } = this.props;
        const { selectNodes, selectNodePair, highlightNodes, changeParam, highlightNodePairs } = this.props;
        const areHighlightsAlsoFocus =
            highlightedNodes.length && numHighlightsAndFocus === highlightedNodes.length;

        return (
            <div className="view" id="highlight-control">
                <h5 className="view-title text-center">
                    Highlight
                    {highlightedNodes.length > 0 && (
                        <Button
                            variant="danger"
                            size="xxs"
                            style={{ marginLeft: "10px" }}
                            onClick={highlightNodes.bind(null, [], null, null, null)}
                        >
                            clear
                        </Button>
                    )}
                </h5>
                <div className="view-body">
                    {/* <div>
                        <Badge variant="dark">{highlightedNodes.length}</Badge> nodes highlighted.
                    </div> */}
                    {highlightedNodes.length > 0 && (
                        <div>
                            <div>
                                <Badge variant="primary">{highlightedNodes.length}</Badge> nodes highlighted.
                            </div>
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
                            {hasLinkPredictions && (
                                <div style={{ marginTop: "10px" }}>
                                    <Button
                                        variant="outline-primary"
                                        size="xs"
                                        onClick={highlightNodePairs.bind(null, null, null, null, null, true)}
                                    >
                                        List top {unseenTopK} predicted unseen edges
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ marginTop: "5px" }}>
                        <div>
                            <span
                                style={{ cursor: "pointer" }}
                                onClick={changeParam.bind(
                                    null,
                                    "nodeFilter.searchShown",
                                    null,
                                    true,
                                    null
                                )}
                            >
                                <FontAwesomeIcon icon={searchShown ? faCaretRight : faCaretDown} />
                            </span>
                            <span style={{ marginLeft: "5px" }}>Search nodes by</span>
                        </div>
                        {searchShown && (
                            <Form inline onSubmit={this.callSearch.bind(this)} style={{ marginLeft: "9px" }}>
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
                        )}
                    </div>

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
    searchShown: state.param.nodeFilter.searchShown,
    unseenTopK: state.param.unseenTopK,
    hasLinkPredictions: state.hasLinkPredictions,
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
            changeParam,
            highlightNodePairs,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(HighlightControl);
