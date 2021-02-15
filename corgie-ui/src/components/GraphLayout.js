import React, { Component } from "react";
import { connect, ReactReduxContext, Provider } from "react-redux";
import { bindActionCreators } from "redux";
import { Stage, Layer, Group, Rect, Line } from "react-konva";
import NodeRep from "./NodeRep";
import { FocusLayer, HighlightLayer, HoverLayer } from "./NodeLayers";
import { highlightNodes, hoverNode, selectNodePair } from "../actions";

class GraphLayout extends Component {
    render() {
        const {
            layoutData,
            nodes,
            nodeColors,
            spec,
            selectedNodes,
            highlightedNodes,
            highlightedEdges,
            hoveredNeighbors,
            hoveredEdges,
        } = this.props;
        const { width, height, coords, groups } = layoutData;
        const canvasW = width + spec.margin,
            canvasH = height + spec.margin;
        return (
            <ReactReduxContext.Consumer>
                {({ store }) => (
                    <Stage width={canvasW} height={canvasH}>
                        <Provider store={store}>
                            <BaseLayer coords={coords} groups={groups} />

                            {selectedNodes.length > 0 && (
                                <FocusLayer
                                    focalGroups={selectedNodes}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={spec.nodeSize}
                                />
                            )}
                            {highlightedNodes.length > 0 && (
                                <HighlightLayer
                                    highlightedNodes={highlightedNodes}
                                    highlightedEdges={highlightedEdges}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={spec.nodeSize}
                                />
                            )}
                            {hoveredNeighbors.length > 0 && (
                                <HoverLayer
                                    width={canvasW}
                                    height={canvasH}
                                    hoveredNodes={hoveredNeighbors}
                                    hoveredEdges={hoveredEdges}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={spec.nodeSize}
                                />
                            )}
                        </Provider>
                    </Stage>
                )}
            </ReactReduxContext.Consumer>
        );
    }
}
const mapStateToProps = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    spec: state.spec.graph,
    nodeColors: state.nodeColors,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    highlightedEdges: state.highlightedEdges,
    hoveredNeighbors: state.hoveredNeighbors,
    hoveredEdges: state.hoveredEdges,
});

export default connect(mapStateToProps)(GraphLayout);

class BaseLayerUnconnected extends Component {
    render() {
        console.log("GraphLayout BaseLayer render()");

        const { spec, nodes, edges, coords, nodeColors, groups } = this.props;
        const { nodeSize } = spec;

        return (
            <Layer>
                <Group>
                    {edges.map((e, i) => (
                        <Line
                            key={i}
                            points={[
                                coords[e.source].x,
                                coords[e.source].y,
                                coords[e.target].x,
                                coords[e.target].y,
                            ]}
                            stroke="#aaa"
                            strokeWidth={1}
                            hitStrokeWidth={2}
                            opacity={0.5}
                            onMouseOver={this.props.hoverNode.bind(null, [e.source, e.target])}
                            onMouseOut={this.props.hoverNode.bind(null, null)}
                            onClick={this.props.highlightNodes.bind(
                                null,
                                [e.source, e.target],
                                null,
                                "graph",
                                null
                            )}
                        />
                    ))}
                </Group>
                {groups && (
                    <Group>
                        {groups.map((g, i) => (
                            <Rect
                                key={i}
                                rx={5}
                                ry={5}
                                x={g.bounds.x}
                                y={g.bounds.y}
                                width={g.bounds.width || g.bounds.width()}
                                height={g.bounds.height || g.bounds.height()}
                                stroke="grey"
                                strokeWidth={1}
                                dash={[5, 5]}
                                fillEnabled={false}
                            />
                        ))}
                    </Group>
                )}
                <Group>
                    {coords.map((c, i) => (
                        <NodeRep
                            key={i}
                            x={c.x}
                            y={c.y}
                            radius={nodeSize}
                            typeId={nodes[i].typeId}
                            style={{ fill: nodeColors[i], opacity: 1, strokeEnabled: false }}
                            events={{
                                onMouseOver: this.props.hoverNode.bind(null, i),
                                onMouseOut: this.props.hoverNode.bind(null, null),
                                onClick: this.props.highlightNodes.bind(null, [i], null, "graph", null),
                            }}
                        />
                    ))}
                </Group>
            </Layer>
        );
    }
}

const mapStateToPropsBaseLayer = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    spec: state.spec.graph,
    nodeColors: state.nodeColors,
});

const mapDispatchToPropsBaseLayer = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
            selectNodePair,
        },
        dispatch
    );

const BaseLayer = connect(mapStateToPropsBaseLayer, mapDispatchToPropsBaseLayer)(BaseLayerUnconnected);
