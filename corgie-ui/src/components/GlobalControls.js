import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import { Form, Dropdown, DropdownButton, Button } from "react-bootstrap";
import { highlightNodeType, changeHops, changeParam } from "../actions";
import NodeRep from "./NodeRep";

export class GlobalControls extends Component {
    render() {
        const { graph, param, nodeAttrs } = this.props;
        const { nodes, edges, nodeTypes } = graph;
        const { colorBy } = param;

        return (
            <div id="global-controls">
                <div className="graph-info">
                    <div>
                        # nodes: {nodes.length}, # edges: {edges.length}
                    </div>
                    {/* <div></div> */}
                    {/* <div># node types: {nodeTypes.length}</div> */}
                    {nodeTypes.length > 1 && (
                        <div>
                            <svg id="legends" width="200" height="20">
                                <g transform="translate(10,10)">
                                    {nodeTypes.map((nt, i) => (
                                        <g
                                            key={i}
                                            transform={`translate(${100 * i},0)`}
                                            className="node"
                                            onMouseEnter={this.props.highlightNodeType.bind(this, i)}
                                            onMouseLeave={this.props.highlightNodeType.bind(this, null)}
                                        >
                                            <NodeRep
                                                shape={i === 0 ? "triangle" : "circle"}
                                                r={i === 0 ? 4 : 5}
                                            />
                                            <text x={10} y={4}>
                                                {nt.name} ({nt.count})
                                            </text>
                                        </g>
                                    ))}
                                </g>
                                {/* <g transform="translate(10,25)" className="node selected">
                                <NodeRep shape="triangle" r={4} />
                                <g transform="translate(14,-1)">
                                    <NodeRep shape="circle" r={5} />
                                </g>
                                <text x={22} y={4}>
                                    selected nodes
                                </text>
                            </g>
                            <g transform="translate(10,40)" className="node hop-1">
                                <NodeRep shape="triangle" r={4} />
                                <g transform="translate(14,-1)">
                                    <NodeRep shape="circle" r={5} />
                                </g>
                                <text x={22} y={4}>
                                    1-hop neighbor
                                </text>
                            </g>
                            <g transform="translate(10,55)" className="node hop-2">
                                <NodeRep shape="triangle" r={4} />
                                <g transform="translate(14,-1)">
                                    <NodeRep shape="circle" r={5} />
                                </g>
                                <text x={22} y={4}>
                                    2-hop neighbor
                                </text>
                            </g> */}
                            </svg>
                        </div>
                    )}

                    <div>
                        <Form inline>
                            <Form.Group controlId="select-neighbor-hop">
                                <Form.Label column="sm"># hops considered </Form.Label>
                                <Form.Control
                                    as="select"
                                    size="sm"
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
                                    size="sm"
                                    value={param.hopsHighlight}
                                    onChange={(e) => {
                                        this.props.changeParam("hopsHighlight", parseInt(e.target.value));
                                    }}
                                >
                                    <option value={1}>1</option>
                                    <option value={2}>2</option>
                                    <option value={3}>3</option>
                                </Form.Control>
                            </Form.Group>
                        </Form>
                    </div>

                    <div style={{ display: "flex" }}>
                        <div>Node color: </div>
                        <Dropdown
                            onSelect={(k) => {
                                this.props.changeParam("colorBy", k, false);
                            }}
                        >
                            <Dropdown.Toggle id="color-by-toggle-btn" size="sm">
                                {colorBy === "position" ? "UMAP position" : nodeAttrs[colorBy].name}
                            </Dropdown.Toggle>

                            <Dropdown.Menu>
                                <Dropdown.Item eventKey={"position"}>UMAP position</Dropdown.Item>
                                <Dropdown.Divider />
                                {nodeAttrs.map((a, i) => (
                                    <Dropdown.Item key={i} eventKey={i}>
                                        {a.name}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodeType,
            changeHops,
            changeParam,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GlobalControls);
