import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, Button, ButtonGroup } from "react-bootstrap";
import { format as d3Format } from "d3";
import { Stage, Layer, Group, Text } from "react-konva";
import { highlightNodes, changeHops, changeParam, hoverNode } from "../actions";
import NodeRep from "./NodeRep";

export class GlobalControls extends Component {
    hoverNodeType(typeId) {
        const { nodes } = this.props.graph;
        const targets = nodes.filter((x) => x.typeId === typeId).map((x) => x.id);
        this.props.hoverNode(targets);
    }

    render() {
        const { graph, param, attrMeta, changeParam, hoverNode, highlightNodes } = this.props;
        const { nodes, edges, nodeTypes } = graph;
        const { colorBy, colorScale, nodeSize } = param;
        let e, numberFormat, colorMin, colorMax;
        if (colorBy !== -1) {
            e = colorScale.domain();
            colorMin = colorScale(e[0]);
            colorMax = colorScale(e[1]);
            numberFormat = e[0] < 1 ? d3Format("~g") : d3Format("~s");
        }

        return (
            <div id="global-controls">
                <div className="graph-info">
                    <div>
                        # nodes: {nodes.length}, # edges: {edges.length}
                    </div>

                    <div style={{ display: "flex" }}>
                        <div style={{ marginRight: "5px" }}>Node color: </div>
                        <Dropdown
                            onSelect={(k) => {
                                this.props.changeParam("colorBy", parseInt(k), false);
                            }}
                        >
                            <Dropdown.Toggle id="color-by-toggle-btn" size="xs" variant="outline-primary">
                                {colorBy === -1 ? "UMAP position" : colorBy}
                            </Dropdown.Toggle>

                            <Dropdown.Menu>
                                <Dropdown.Item eventKey={-1}>UMAP position</Dropdown.Item>
                                <Dropdown.Divider />
                                {attrMeta.map((a, i) => (
                                    <Dropdown.Item key={i} eventKey={i}>
                                        {a.nodeType}: {a.name}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>

                        {colorBy !== -1 && (
                            <div style={{ marginLeft: "10px" }}>
                                <span style={{ marginRight: "3px" }}>{numberFormat(e[0])}</span>
                                <div
                                    style={{
                                        display: "inline-block",
                                        height: "10px",
                                        width: "100px",
                                        background: `linear-gradient(90deg, ${colorMin} 0%, ${colorMax} 100%)`,
                                    }}
                                ></div>
                                <span style={{ marginLeft: "3px" }}>{numberFormat(e[1])}</span>
                            </div>
                        )}
                    </div>

                    {nodeTypes.length > 1 && (
                        <div>
                            <Stage width={80 * nodeTypes.length + 10} height={20}>
                                <Layer>
                                    <Group x={5}>
                                        {nodeTypes.map((nt, i) => (
                                            <Group
                                                key={i}
                                                x={i * 80}
                                                y={0}
                                                onMouseOver={this.hoverNodeType.bind(this, i)}
                                                onMouseOut={hoverNode.bind(null, null)}
                                                onClick={highlightNodes.bind(
                                                    null,
                                                    null,
                                                    null,
                                                    "node-type",
                                                    i
                                                )}
                                            >
                                                <NodeRep
                                                    x={0}
                                                    y={13}
                                                    radius={i === 0 ? 5 : 6}
                                                    typeId={i}
                                                    style={{
                                                        fill: "grey",
                                                        strokeEnabled: false,
                                                    }}
                                                />
                                                <Text x={10} y={5} text={nt.name} fontSize={16}></Text>
                                            </Group>
                                        ))}
                                    </Group>
                                </Layer>
                            </Stage>
                        </div>
                    )}

                    <div>
                        <Form inline>
                            <Form.Group controlId="select-neighbor-hop">
                                <Form.Label column="sm"># hops considered </Form.Label>
                                <Form.Control
                                    as="select"
                                    size="xs"
                                    value={param.hops}
                                    onChange={(e) => {
                                        this.props.changeHops(parseInt(e.target.value));
                                    }}
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                </Form.Control>
                            </Form.Group>

                            <Form.Group controlId="highlight-neighbor-hop">
                                <Form.Label column="sm"># hops to highlight</Form.Label>
                                <Form.Control
                                    as="select"
                                    size="xs"
                                    value={param.hopsHighlight}
                                    onChange={(e) => {
                                        changeParam("hopsHighlight", parseInt(e.target.value));
                                    }}
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                </Form.Control>
                            </Form.Group>
                        </Form>
                    </div>

                    <div>
                        <span>Node size: </span>
                        <ButtonGroup size="xs">
                            <Button
                                variant="outline-secondary"
                                onClick={changeParam.bind(null, "nodeSize", nodeSize + 1, false, null)}
                            >
                                +
                            </Button>
                            <Button
                                variant="outline-secondary"
                                onClick={() => {
                                    if (nodeSize > 1) {
                                        changeParam("nodeSize", nodeSize - 1);
                                    }
                                }}
                            >
                                -
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    graph: state.graph,
    param: state.param,
    attrMeta: state.attrMeta,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
            changeHops,
            changeParam,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GlobalControls);
