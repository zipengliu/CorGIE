import React, { Component, memo, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import debounce from "lodash.debounce";
import { Form, ButtonGroup, Button, Badge } from "react-bootstrap";
import { FixedSizeList } from "react-window";
import { format } from "d3";
import { getNeighborDistance, getCosineDistance } from "../utils";
import { highlightNodePairs, hoverNode, selectNodePair, changeParam } from "../actions";
import { ComputingSpinner } from "./GraphView";
import ScatterHistogram from "./ScatterHistogram";

export class NodePairView extends Component {
    render() {
        const {
            nodes,
            hops,
            highlightedNodePairs,
            distances,
            nodePairFilter,
            spec,
            highlightDistVals,
        } = this.props;
        const { highlightNodePairs, changeParam } = this.props;
        const labelOrId = nodes && nodes[0].label ? "label" : "id";
        const { display } = distances;
        const { useLinearScale } = nodePairFilter;
        const numFormat = format(".2~s");

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
            <div className="view" id="node-pair-view">
                <h5 className="view-title text-center">Node Pair</h5>
                <div className="view-body">
                    <div style={{ paddingRight: "5px", borderRight: "1px dotted grey" }}>
                        <h6>Highlighted</h6>
                        <div>
                            <Badge variant="primary">{highlightedNodePairs.length}</Badge> node pairs
                            highlighted. {highlightedNodePairs.length > 0 && "Click to focus."}
                        </div>
                        {highlightedNodePairs.length > 0 && (
                            <div>
                                <div className="node-pair-list">
                                    <FixedSizeList
                                        className="list-group"
                                        height={
                                            highlightedNodePairs.length > 16
                                                ? 400
                                                : 25 * highlightedNodePairs.length
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
                                        onClick={highlightNodePairs.bind(null, null, null)}
                                    >
                                        clear highlights
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ paddingLeft: "5px" }}>
                        <h6>Compare distances of node pairs in latent vs. topo</h6>
                        <div>
                            <Form inline>
                                <Form.Label style={{ marginRight: "5px" }}>
                                    Luminance ~ #node pairs with specific distance values.
                                </Form.Label>
                                <Form.Label style={{ marginRight: "5px" }}>Choose scale type:</Form.Label>
                                <Form.Check
                                    inline
                                    label="linear"
                                    type="radio"
                                    id="scale-linear-ctrl"
                                    checked={useLinearScale}
                                    onChange={() => {
                                        changeParam("nodePairFilter.useLinearScale", null, true);
                                    }}
                                />
                                <Form.Check
                                    inline
                                    label="log10"
                                    type="radio"
                                    id="scale-log-ctrl"
                                    checked={!useLinearScale}
                                    onChange={() => {
                                        changeParam("nodePairFilter.useLinearScale", null, true);
                                    }}
                                />
                            </Form>
                        </div>
                        <div className="scatter-hist-list">
                            {display.map((d, i) => (
                                <div className="stuff-container" key={i}>
                                    <div className="container-title">
                                        {d.title} (#={d.src? numFormat(d.src.length): ''})
                                    </div>
                                    <div className="container-body">
                                        {d.isComputing ? (
                                            <ComputingSpinner />
                                        ) : (
                                            <ScatterHistogram
                                                data={d}
                                                hasHist={true}
                                                useLinearScale={useLinearScale}
                                                spec={spec}
                                                xLabel="latent"
                                                yLabel="topo"
                                                hVals={highlightDistVals}
                                                brushedFunc={highlightNodePairs.bind(null, i)}
                                                brushedArea={
                                                    nodePairFilter.which === i
                                                        ? nodePairFilter.brushedArea
                                                        : null
                                                }
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="view-footer">
                    Topological distance of node pair = 1.0 - Jaccard Index of {hops}-hop neighbor sets of two
                    nodes. <br />
                    Latent distance of node pair = cosine distance of node embeddings.
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const emb = state.latent.emb;
    const { neighborMasks } = state.graph;
    const { hoveredNodes, selectedNodes } = state;

    let highlightDistVals = null,
        hx = null,
        hy;
    if (!state.distances.display[0].isComputing) {
        if (!!hoveredNodes && hoveredNodes.length === 2) {
            hx = hoveredNodes[0];
            hy = hoveredNodes[1];
        } else if (
            selectedNodes.length === 2 &&
            selectedNodes[0].length === 1 &&
            selectedNodes[1].length === 1
        ) {
            hx = selectedNodes[0][0];
            hy = selectedNodes[1][0];
        }
        if (hx !== null) {
            highlightDistVals = [
                getCosineDistance(emb[hx], emb[hy]),
                getNeighborDistance(neighborMasks[hx], neighborMasks[hy], state.param.neighborDistanceMetric),
            ];
        }
    }
    return {
        nodes: state.graph.nodes,
        highlightedNodePairs: state.highlightedNodePairs,
        highlightDistVals,
        distances: state.distances,
        spec: state.spec.scatterHist,
        nodePairFilter: state.param.nodePairFilter,
        hops: state.param.hops,
    };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodePairs,
            hoverNode,
            selectNodePair,
            changeParam,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(NodePairView);
