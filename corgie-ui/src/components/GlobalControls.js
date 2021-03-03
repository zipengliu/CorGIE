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
        const { nodeTypes } = graph;
        const { colorBy, colorScale, nodeSize, hops, hopsHover, onlyActivateOne } = param;
        let e, numberFormat, colorMin, colorMax;
        if (colorBy !== -1) {
            e = colorScale.domain();
            colorMin = colorScale(e[0]);
            colorMax = colorScale(e[1]);
            numberFormat = e[0] < 1 ? d3Format("~g") : d3Format("~s");
        }

        return (
            <div id="global-controls" className="view">
                <h5 className="view-title">Settings</h5>
                <div className="view-body">
                    <div className="setting-item">
                        <div style={{ marginRight: "5px" }}>Node color: </div>
                        <Dropdown
                            onSelect={(k) => {
                                this.props.changeParam("colorBy", parseInt(k), false);
                            }}
                        >
                            <Dropdown.Toggle id="color-by-toggle-btn" size="xs" variant="outline-secondary">
                                {colorBy === -1 ? "UMAP position" : colorBy}
                            </Dropdown.Toggle>

                            <Dropdown.Menu>
                                <Dropdown.Item eventKey={-1}>UMAP position</Dropdown.Item>
                                {attrMeta.length > 0 && <Dropdown.Divider />}
                                {attrMeta.map((a, i) => (
                                    <Dropdown.Item key={i} eventKey={i}>
                                        {a.nodeType}: {a.name}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>

                    {colorBy !== -1 && (
                        <div>
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

                    {nodeTypes.length > 1 && (
                        <div className="setting-item">
                            <div style={{ marginRight: "5px" }}>Node shape: </div>
                            <Stage width={100} height={21 * nodeTypes.length}>
                                <Layer>
                                    <Group x={5}>
                                        {nodeTypes.map((nt, i) => (
                                            <Group
                                                key={i}
                                                x={0}
                                                y={i * 21}
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
                                                <Text
                                                    x={10}
                                                    y={5}
                                                    text={`${nt.name} (${nt.count})`}
                                                    fontSize={16}
                                                ></Text>
                                            </Group>
                                        ))}
                                    </Group>
                                </Layer>
                            </Stage>
                        </div>
                    )}

                    <div className="setting-item">
                        <div style={{ marginRight: "5px" }}>Node size: </div>
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

                    <div className="setting-item">
                        <div style={{ marginRight: "5px" }}>#Hops to highlight: </div>
                        <Dropdown
                            onSelect={(h) => {
                                this.props.changeParam("hopsHover", parseInt(h), false);
                            }}
                        >
                            <Dropdown.Toggle id="hops-to-show" size="xs" variant="outline-secondary">
                                {hopsHover}
                            </Dropdown.Toggle>

                            <Dropdown.Menu>
                                {new Array(hops).fill(0).map((_, i) => (
                                    <Dropdown.Item key={i} eventKey={i + 1}>
                                        {i + 1}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>

                    <div className="setting-item">
                        <Form>
                            <Form.Check
                                type="switch"
                                id="activate-one-or-neighbor-switch"
                                checked={!onlyActivateOne}
                                onChange={changeParam.bind(
                                    null,
                                    "onlyActivateOne",
                                    null,
                                    true,
                                    null
                                )}
                                label="Activate neighbors on hover / click"
                            />
                        </Form>
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
