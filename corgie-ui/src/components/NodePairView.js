import React, { Component, memo, useCallback } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import debounce from "lodash.debounce";
import { Form, Modal, Button, Badge, Col } from "react-bootstrap";
import { FixedSizeList } from "react-window";
import { format } from "d3";
import { getNeighborDistance, getCosineDistance } from "../utils";
import {
    highlightNodePairs,
    hoverNode,
    selectNodePair,
    changeParam,
    changeScatterplotForm,
    addDistanceScatterplot,
} from "../actions";
import { ComputingSpinner } from "./GraphView";
import ScatterHistogram from "./ScatterHistogram";

export class NodePairView extends Component {
    renderCreateModal() {
        const { highlightedNodes, hasLinkPredictions, selectedNodes, formData } = this.props;
        const { show, connectivity, userInterests, linkPrediction, nodePairs } = formData;
        const { changeScatterplotForm } = this.props;
        const numFoc = selectedNodes.length;
        const btwFoc = [];
        for (let i = 0; i < numFoc; i++) {
            for (let j = i + 1; j < numFoc; j++) {
                btwFoc.push([i, j]);
            }
        }

        return (
            <Modal
                show={show}
                size="lg"
                centered
                id="create-scatterplot-modal"
                onHide={this.props.changeScatterplotForm.bind(null, "show", false)}
            >
                <Modal.Header closeButton>
                    <Modal.Title>Create new node-pair scatterplot</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Row>
                            <Form.Label column sm={2}>
                                Connectivity
                            </Form.Label>
                            <Col>
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="all"
                                    checked={connectivity === "all"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "all")}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="connected by an edge"
                                    checked={connectivity === "edge"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "edge")}
                                />
                                <Form.Check
                                    inline
                                    type="radio"
                                    label="not connected"
                                    checked={connectivity === "nonedge"}
                                    onChange={changeScatterplotForm.bind(null, "connectivity", "nonedge")}
                                />
                            </Col>
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>

                        <Form.Row>
                            <Form.Label column sm={2}>
                                User interests
                            </Form.Label>
                            <Col>
                                {(highlightedNodes.length > 1 || selectedNodes.length > 0) && (
                                    <Form.Row>
                                        <Col>
                                            <Form.Check
                                                type="radio"
                                                label="all"
                                                checked={userInterests === "all"}
                                                onChange={changeScatterplotForm.bind(
                                                    null,
                                                    "userInterests",
                                                    "all"
                                                )}
                                            />
                                        </Col>
                                    </Form.Row>
                                )}
                                {highlightedNodes.length > 1 && (
                                    <Form.Row>
                                        <Col>
                                            <Form.Check
                                                type="radio"
                                                label="within highlighted nodes"
                                                checked={userInterests === "highlight"}
                                                onChange={changeScatterplotForm.bind(
                                                    null,
                                                    "userInterests",
                                                    "highlight"
                                                )}
                                            />
                                        </Col>
                                    </Form.Row>
                                )}
                                {selectedNodes.length > 0 && (
                                    <Form.Row>
                                        {selectedNodes.map((s, i) => (
                                            <Col key={i}>
                                                <Form.Check
                                                    type="radio"
                                                    label={`within foc-${i}`}
                                                    checked={userInterests === `foc-${i}`}
                                                    onChange={changeScatterplotForm.bind(
                                                        null,
                                                        "userInterests",
                                                        `foc-${i}`
                                                    )}
                                                />
                                            </Col>
                                        ))}
                                    </Form.Row>
                                )}
                                {btwFoc.length > 0 && (
                                    <Form.Row>
                                        {btwFoc.map((g, i) => (
                                            <Col key={i} md={4}>
                                                <Form.Check
                                                    type="radio"
                                                    label={`between foc-${g[0]} & foc-${g[1]}`}
                                                    checked={userInterests === `foc-${g[0]}*foc-${g[1]}`}
                                                    onChange={changeScatterplotForm.bind(
                                                        null,
                                                        "userInterests",
                                                        `foc-${g[0]}*foc-${g[1]}`
                                                    )}
                                                />
                                            </Col>
                                        ))}
                                    </Form.Row>
                                )}
                                {highlightedNodes.length < 2 && !selectedNodes.length && (
                                    <Form.Text>
                                        Not applicable. Please specify interests by highlighting or focusing
                                        nodes.
                                    </Form.Text>
                                )}
                            </Col>
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>
                        <Form.Row>
                            <Form.Label column sm={2}>
                                Link prediction
                            </Form.Label>
                            {hasLinkPredictions ? (
                                <Col>
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="all"
                                        checked={linkPrediction === "all"}
                                        onChange={changeScatterplotForm.bind(null, "linkPrediction", "all")}
                                    />
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="predicted true"
                                        checked={linkPrediction === "pred-true"}
                                        onChange={changeScatterplotForm.bind(
                                            null,
                                            "linkPrediction",
                                            "pred-true"
                                        )}
                                    />
                                    <Form.Check
                                        inline
                                        type="radio"
                                        label="predicted false"
                                        checked={linkPrediction === "pred-false"}
                                        onChange={changeScatterplotForm.bind(
                                            null,
                                            "linkPrediction",
                                            "pred-false"
                                        )}
                                    />

                                    <Form.Text>
                                        Note that prediction only applies to node pairs with specific node
                                        types in k-partitie graph.
                                    </Form.Text>
                                </Col>
                            ) : (
                                <Col>
                                    <Form.Text>Not applicable. No link prediction results loaded.</Form.Text>
                                </Col>
                            )}
                        </Form.Row>

                        <div style={{ marginBottom: "20px" }}></div>

                        <div style={{ marginBottom: "10px" }}>
                            Number of filtered node pairs: {nodePairs.length}
                        </div>
                        <Button
                            type="submit"
                            onClick={this.props.addDistanceScatterplot}
                            disabled={!nodePairs.length}
                        >
                            Create
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        );
    }

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
        const { display, displaySpecial } = distances;
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
                <h5 className="view-title text-center">Node Pairs</h5>
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
                                <div>
                                    <Button
                                        variant="outline-danger"
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
                            <Button
                                size="xs"
                                variant="outline-primary"
                                onClick={this.props.changeScatterplotForm.bind(null, "show", true)}
                            >
                                Create distance distribution with self-specified conditions
                            </Button>
                        </div>
                        <div>
                            <Form inline>
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
                            {displaySpecial.concat(display).map((d, i) => (
                                <div className="stuff-container" key={i}>
                                    <div className="container-title">
                                        {d.title} (#={d.src ? numFormat(d.src.length) : ""})
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
                    Latent distance of node pair = cosine distance of node embeddings. <br />
                    Luminance ~ #node pairs with specific distance values.
                    {this.props.selectedNodes.length > 2 && (
                        <div style={{ fontWeight: "bold" }}>
                            Note: the diff will only show up when there are exactly 2 focal groups.
                        </div>
                    )}
                </div>

                {this.renderCreateModal()}
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
        selectedNodes,
        hasLinkPredictions: state.hasLinkPredictions,
        highlightedNodePairs: state.highlightedNodePairs,
        highlightedNodes: state.highlightedNodes,
        highlightDistVals,
        distances: state.distances,
        spec: state.spec.scatterHist,
        nodePairFilter: state.param.nodePairFilter,
        hops: state.param.hops,
        formData: state.scatterplotForm,
    };
};

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodePairs,
            hoverNode,
            selectNodePair,
            changeParam,
            changeScatterplotForm,
            addDistanceScatterplot,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(NodePairView);
