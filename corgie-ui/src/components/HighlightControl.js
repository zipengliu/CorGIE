import React, { Component, memo, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, ButtonGroup, Button } from "react-bootstrap";
import { FixedSizeList } from "react-window";
import debounce from "lodash.debounce";
import {
    selectNodes,
    highlightNodes,
    searchNodes,
    highlightNodePairs,
    hoverNode,
    selectNodePair,
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
        const { nodes, selectedNodes, highlightedNodes, highlightedNodePairs } = this.props;
        const labelOrId = nodes && nodes[0].label ? "label" : "id";

        const NodePairItem = memo(({ index, style }) => {
            const p = highlightedNodePairs[index];
            const debouncedHover = useCallback(debounce((x) => this.props.hoverNode(x), 200));
            return (
                <div
                    className="list-group-item"
                    onMouseEnter={debouncedHover.bind(this, [p[0], p[1]])}
                    onMouseLeave={debouncedHover.bind(this, null)}
                    onClick={this.props.selectNodePair.bind(null, p[0], p[1])}
                    style={style}
                >
                    {nodes[p[0]][labelOrId]} - {nodes[p[1]][labelOrId]}
                </div>
            );
        });

        return (
            <div className="view" id="highlight-control">
                <h5 className="text-center">Highlight</h5>
                <h6>Nodes</h6>
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

                <div>{highlightedNodes.length} nodes are highlighted (blinking).</div>
                {highlightedNodes.length > 0 && (
                    <div>
                        {/* <div>Actions:</div> */}
                        <div>
                            <Button
                                variant="outline-primary"
                                size="xs"
                                onClick={this.props.selectNodes.bind(null, "CREATE", highlightedNodes, null)}
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

                <div className="section-divider"></div>
                <h6>Node pairs</h6>
                <div>{highlightedNodePairs.length} node pairs are highlighted. Click to focus.</div>
                {highlightedNodePairs.length > 0 && (
                    <div>
                        <div className="node-pair-list">
                            <FixedSizeList
                                height={
                                    highlightedNodePairs.length > 16 ? 400 : 25 * highlightedNodePairs.length
                                }
                                width="100%"
                                itemSize={25}
                                itemCount={highlightedNodePairs.length}
                            >
                                {NodePairItem}
                            </FixedSizeList>
                        </div>
                        {/* <div>
                            <span style={{ marginRight: "5px" }}>Order by latent distance:</span>
                            <ButtonGroup size="xs">
                                <Button
                                    variant="outline-secondary"
                                    active={nodePairFilter.ascending}
                                    onClick={changeParam.bind(
                                        this,
                                        "nodePairFilter.ascending",
                                        true,
                                        false,
                                        null
                                    )}
                                >
                                    asc.
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    active={!nodePairFilter.ascending}
                                    onClick={changeParam.bind(
                                        this,
                                        "nodePairFilter.ascending",
                                        false,
                                        false,
                                        null
                                    )}
                                >
                                    desc.
                                </Button>
                            </ButtonGroup>
                        </div> */}
                        <div>
                            <Button
                                variant="outline-secondary"
                                size="xs"
                                onClick={this.props.highlightNodePairs.bind(null, null, null)}
                            >
                                clear highlights
                            </Button>
                        </div>
                    </div>
                )}

                {/* <div className="section-divider"></div>
                <h6>Hover</h6> */}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ 
    nodes: state.graph.nodes,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    highlightedNodePairs: state.highlightedNodePairs,
    // nodePairFilter: state.param.nodePairFilter,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodes,
            highlightNodes,
            highlightNodePairs,
            searchNodes,
            hoverNode,
            selectNodePair,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(HighlightControl);
