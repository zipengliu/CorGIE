import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, Button, ButtonGroup } from "react-bootstrap";
import { format as d3Format } from "d3";
import { Stage, Layer, Group, Text } from "react-konva";
import { range as lodashRange } from "lodash";
import { highlightNodes, changeHops, changeParam, hoverNode } from "../actions";
import NodeRep from "./NodeRep";

export class GlobalControls extends Component {
    colorByNaming = {
        umap: "UMAP position",
        "pred-labels": "predicted labels",
        "true-labels": "true labels",
        correctness: "label correctness",
        "node-type": "node type",
    };
    nodeLabelNaming = {
        all: "all",
        correct: "correct prediction",
        wrong: "wrong prediction",
    };

    componentWillMount() {
        const { attrMeta, numNodeClasses } = this.props;
        for (let i = 0; i < attrMeta.length; i++) {
            const a = attrMeta[i];
            this.colorByNaming[i] = `${a.nodeType}: ${a.name}`; // Use the attribute name as colorBy for convinience
        }
        if (numNodeClasses) {
            for (let i = 0; i < numNodeClasses; i++) {
                this.nodeLabelNaming[`pred-${i}`] = `predicted: ${i}`;
                this.nodeLabelNaming[`true-${i}`] = `true: ${i}`;
            }
        }
    }

    hoverNodeType(typeId) {
        const { nodes } = this.props.graph;
        const targets = nodes.filter((x) => x.typeId === typeId).map((x) => x.id);
        this.props.hoverNode(targets);
    }

    render() {
        const { graph, param, attrMeta, changeParam, hoverNode, highlightNodes, numNodeClasses } = this.props;
        const { colorByNaming, nodeLabelNaming } = this;
        const { nodeTypes } = graph;
        const { colorBy, colorScale, nodeSize, hops, hopsHover } = param;
        const { onlyActivateOne, highlightNodeType, highlightNodeLabel } = param;
        let e, numberFormat, colorMin, colorMax;
        const useAttrColors = Number.isInteger(colorBy);
        if (useAttrColors) {
            e = colorScale.domain();
            colorMin = colorScale(e[0]);
            colorMax = colorScale(e[1]);
            numberFormat = e[0] < 1 ? d3Format("~g") : d3Format("~s");
            // TODO show color legends for labels and node types
        }

        return (
            <div id="global-controls" className="view">
                <h5 className="view-title">Settings</h5>
                <div className="view-body">
                    <div className="setting-item">
                        <div style={{ marginRight: "5px" }}>Node color: </div>
                        <div>
                            <Dropdown
                                onSelect={(k) => {
                                    this.props.changeParam("colorBy", k, false);
                                }}
                            >
                                <Dropdown.Toggle
                                    id="color-by-toggle-btn"
                                    size="xs"
                                    variant="outline-secondary"
                                >
                                    {colorByNaming[colorBy]}
                                </Dropdown.Toggle>

                                <Dropdown.Menu>
                                    <Dropdown.Item eventKey="umap" active={colorBy === "umap"}>
                                        {colorByNaming["umap"]}
                                    </Dropdown.Item>

                                    {numNodeClasses && (
                                        <div>
                                            <Dropdown.Divider />
                                            {["pred-labels", "true-labels", "correctness"].map((k) => (
                                                <Dropdown.Item key={k} eventKey={k} active={colorBy === k}>
                                                    {colorByNaming[k]}
                                                </Dropdown.Item>
                                            ))}
                                        </div>
                                    )}

                                    {attrMeta.length > 0 && <Dropdown.Divider />}
                                    {attrMeta.map((a, i) => (
                                        <Dropdown.Item key={i} eventKey={i} active={colorBy === i}>
                                            {colorByNaming[i]}
                                        </Dropdown.Item>
                                    ))}

                                    {nodeTypes.length > 1 && (
                                        <div>
                                            <Dropdown.Divider />
                                            <Dropdown.Item eventKey="node-type">
                                                {colorByNaming["node-type"]}
                                            </Dropdown.Item>
                                        </div>
                                    )}
                                </Dropdown.Menu>
                            </Dropdown>

                            {/* Color legends */}
                            {useAttrColors && (
                                <div className="node-color-legends">
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
                            {colorBy === "umap" && (
                                <div className="node-color-legends">
                                    See background color in Latent space view
                                </div>
                            )}
                            {colorBy === "correctness" && (
                                <div className="node-color-legends">
                                    <div className="color-item">
                                        <div
                                            className="color-block"
                                            style={{ backgroundColor: colorScale(false) }}
                                        ></div>
                                        <div className="color-label">correct</div>
                                    </div>
                                    <div className="color-item">
                                        <div
                                            className="color-block"
                                            style={{ backgroundColor: colorScale(true) }}
                                        ></div>
                                        <div className="color-label">wrong</div>
                                    </div>
                                </div>
                            )}
                            {(colorBy === "pred-labels" || colorBy === "true-labels") && (
                                <div className="node-color-legends">
                                    {lodashRange(numNodeClasses).map((i) => (
                                        <div className="color-item" key={i}>
                                            <div
                                                className="color-block"
                                                style={{ backgroundColor: colorScale(i) }}
                                            ></div>
                                            <div className="color-label">{i}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shape legends for node type  */}
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
                                    <Dropdown.Item key={i} eventKey={i + 1} active={hopsHover === i + 1}>
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
                                onChange={changeParam.bind(null, "onlyActivateOne", null, true, null)}
                                label="Activate neighbors on hover / click"
                            />
                        </Form>
                    </div>

                    {nodeTypes.length > 1 && (
                        <div className="setting-item">
                            <div style={{ marginRight: "5px" }}>Brushable node type: </div>
                            <Dropdown
                                onSelect={(k) => {
                                    this.props.changeParam(
                                        "highlightNodeType",
                                        k === "all" ? k : parseInt(k)
                                    );
                                }}
                            >
                                <Dropdown.Toggle
                                    id="highlight-node-type-dropdown"
                                    size="xs"
                                    variant="outline-secondary"
                                >
                                    {highlightNodeType === "all" ? "all" : nodeTypes[highlightNodeType].name}
                                </Dropdown.Toggle>

                                <Dropdown.Menu>
                                    <Dropdown.Item eventKey="all" active={highlightNodeType === "all"}>
                                        all
                                    </Dropdown.Item>
                                    <Dropdown.Divider />
                                    {nodeTypes.map((nt, i) => (
                                        <Dropdown.Item key={i} eventKey={i} active={highlightNodeType === i}>
                                            {nt.name}
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    )}

                    {numNodeClasses && (
                        <div className="setting-item">
                            <div style={{ marginRight: "5px" }}>Brushable node label: </div>
                            <Dropdown
                                onSelect={(k) => {
                                    this.props.changeParam("highlightNodeLabel", k);
                                }}
                            >
                                <Dropdown.Toggle
                                    id="highlight-node-type-dropdown"
                                    size="xs"
                                    variant="outline-secondary"
                                >
                                    {nodeLabelNaming[highlightNodeLabel]}
                                </Dropdown.Toggle>

                                <Dropdown.Menu>
                                    <Dropdown.Item eventKey="all" active={highlightNodeLabel === "all"}>
                                        {nodeLabelNaming["all"]}
                                    </Dropdown.Item>
                                    <Dropdown.Divider />

                                    <Dropdown.Item
                                        eventKey="correct"
                                        active={highlightNodeLabel === "correct"}
                                    >
                                        {nodeLabelNaming["correct"]}
                                    </Dropdown.Item>
                                    <Dropdown.Item eventKey="wrong" active={highlightNodeLabel === "wrong"}>
                                        {nodeLabelNaming["wrong"]}
                                    </Dropdown.Item>
                                    <Dropdown.Divider />

                                    {lodashRange(numNodeClasses)
                                        .map((labelId) => `pred-${labelId}`)
                                        .map((k) => (
                                            <Dropdown.Item
                                                key={k}
                                                eventKey={k}
                                                active={highlightNodeLabel === k}
                                            >
                                                {nodeLabelNaming[k]}
                                            </Dropdown.Item>
                                        ))}
                                    <Dropdown.Divider />

                                    {lodashRange(numNodeClasses)
                                        .map((labelId) => `true-${labelId}`)
                                        .map((k) => (
                                            <Dropdown.Item
                                                key={k}
                                                eventKey={k}
                                                active={highlightNodeLabel === k}
                                            >
                                                {nodeLabelNaming[k]}
                                            </Dropdown.Item>
                                        ))}
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    graph: state.graph,
    param: state.param,
    attrMeta: state.attrMeta,
    numNodeClasses: state.numNodeClasses,
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
