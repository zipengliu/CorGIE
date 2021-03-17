import React, { Component, memo, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Button, Badge } from "react-bootstrap";
import { FixedSizeList } from "react-window";
import debounce from "lodash.debounce";
import { selectNodePair, highlightNodePairs, hoverNode } from "../actions";

export class NodePairList extends Component {
    render() {
        const { nodes, unseenTopK, hasLinkPredictions, highlightedNodes, highlightedNodePairs } = this.props;
        const { selectNodePair, highlightNodePairs } = this.props;

        const labelOrId = nodes && nodes[0].label ? "label" : "id";
        const NodePairItem = memo(({ index, style }) => {
            const p = highlightedNodePairs[index];
            const debouncedHover = useCallback(debounce((x) => this.props.hoverNode(x), 200));
            return (
                <div
                    className="list-group-item"
                    onMouseEnter={debouncedHover.bind(this, [p[0], p[1]])}
                    onMouseLeave={debouncedHover.bind(this, null)}
                    onClick={selectNodePair.bind(null, p[0], p[1])}
                    style={style}
                >
                    {nodes[p[0]][labelOrId]} - {nodes[p[1]][labelOrId]}
                </div>
            );
        });

        return (
            <div>
                <h6>Node pairs</h6>
                {highlightedNodes.length > 0 && hasLinkPredictions && (
                    <div>
                        <Button
                            variant="outline-primary"
                            size="xs"
                            onClick={highlightNodePairs.bind(null, null, null, null, null, true)}
                        >
                            List top {unseenTopK} predicted unseen edges to highlighted nodes
                        </Button>
                    </div>
                )}
                <div>
                    <Badge variant="primary">{highlightedNodePairs.length}</Badge> node pairs highlighted.{" "}
                    {highlightedNodePairs.length > 0 && "Click to focus."}
                </div>
                {highlightedNodePairs.length > 0 && (
                    <div>
                        <div className="node-pair-list">
                            <FixedSizeList
                                className="list-group"
                                height={
                                    highlightedNodePairs.length > 10 ? 250: 25 * highlightedNodePairs.length
                                }
                                width="100%"
                                itemSize={25}
                                itemCount={highlightedNodePairs.length}
                            >
                                {NodePairItem}
                            </FixedSizeList>
                        </div>
                        <div>
                            <Button
                                variant="outline-danger"
                                size="xs"
                                onClick={highlightNodePairs.bind(null, null, null, null)}
                            >
                                clear highlights
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    nodes: state.graph.nodes,
    unseenTopK: state.param.unseenTopK,
    highlightedNodePairs: state.highlightedNodePairs,
    highlightedNodes: state.highlightedNodes,
    hasLinkPredictions: state.hasLinkPredictions,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            selectNodePair,
            highlightNodePairs,
            hoverNode,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(NodePairList);
