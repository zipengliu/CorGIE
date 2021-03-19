import React, { Component, useCallback } from "react";
import { connect, ReactReduxContext, Provider } from "react-redux";
import { bindActionCreators } from "redux";
import { Stage, Layer, Group, Rect, Line, Text } from "react-konva";
import debounce from "lodash.debounce";
import NodeRep from "./NodeRep";
import { FocusLayer, HighlightLayer, HoverLayer } from "./NodeLayers";
import { highlightNodes, hoverNode, selectNodePair } from "../actions";
import { isPointInBox, isNodeBrushable } from "../utils";

const initState = {
    mouseDown: false,
    startPoint: null, // page x and y of starting point
    endPoint: null,
    brushedArea: null, // Coordinates for the brushed area
};

class GraphLayout extends Component {
    constructor(props) {
        super(props);
        this.stageRef = React.createRef();
        this.state = initState;
    }

    // Dup code as in Embeddings2D.js.  TODO: reuse instead dup.
    callHighlightNodes(brushedArea) {
        const { nodes, highlightNodeType, highlightNodeLabel } = this.props;
        const { qt } = this.props.layoutData;
        const candidates = qt.retrieve(brushedArea);
        const targetNodes = [];
        for (let c of candidates) {
            if (
                isNodeBrushable(nodes[c.id], highlightNodeType, highlightNodeLabel) &&
                isPointInBox({ x: c.x + 0.5, y: c.y + 0.5 }, brushedArea)
            ) {
                targetNodes.push(c.id);
            }
        }
        console.log({ candidates, targetNodes, brushedArea });
        // if (targetNodes.length == 0) return;

        this.props.highlightNodes(
            targetNodes,
            brushedArea,
            `graph-node-${this.props.onlyActivateOne ? "only" : "neigh"}`,
            null
        );
    }
    _onMouseDown() {
        const mousePos = this.stageRef.current.getPointerPosition();
        let nextState = {
            mouseDown: true,
            startPoint: mousePos,
            endPoint: mousePos,
            brushedArea: { x: mousePos.x, y: mousePos.y, width: 0, height: 0 },
        };
        this.setState(nextState);

        this.stageRef.current.on("mousemove", () => {
            const curPos = this.stageRef.current.getPointerPosition();
            this.setState({
                endPoint: curPos,
                brushedArea: this._getBrushedArea(curPos),
            });
        });
        this.stageRef.current.on("mouseup", () => {
            this.stageRef.current.off("mousemove");
            this.stageRef.current.off("mouseup");
            const b = { ...this.state.brushedArea };
            this.setState(initState);
            this.callHighlightNodes(b);
        });
    }
    _getBrushedArea(curPos) {
        const p1 = this.state.startPoint,
            p2 = curPos;
        const minX = Math.min(p1.x, p2.x),
            minY = Math.min(p1.y, p2.y),
            maxX = Math.max(p1.x, p2.x),
            maxY = Math.max(p1.y, p2.y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    render() {
        const {
            layoutData,
            nodes,
            nodeColors,
            nodeSize,
            selectedNodes,
            highlightedNodes,
            highlightedEdges,
            hoveredNodesAndNeighbors,
            hoveredEdges,
            useEdgeBundling,
        } = this.props;
        const { width, height, coords, groups, qt } = layoutData;
        const canvasW = width + 2,
            canvasH = height + 2;
        const ebp = useEdgeBundling ? layoutData.edgeBundlePoints : null;

        return (
            <ReactReduxContext.Consumer>
                {({ store }) => (
                    <Stage
                        width={canvasW}
                        height={canvasH}
                        ref={this.stageRef}
                        onMouseDown={!!qt ? this._onMouseDown.bind(this) : () => {}}
                    >
                        <Provider store={store}>
                            <BaseLayer coords={coords} groups={groups} edgeBundlePoints={ebp} />

                            {selectedNodes.length > 0 && (
                                <FocusLayer
                                    focalGroups={selectedNodes}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                    useStroke={this.props.useStrokeForFocal ? "#000" : false}
                                />
                            )}
                            {highlightedNodes.length > 0 && (
                                <HighlightLayer
                                    highlightedNodes={highlightedNodes}
                                    highlightedEdges={highlightedEdges}
                                    coords={coords}
                                    edgeBundlePoints={ebp}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                    width={canvasW}
                                    height={canvasH}
                                />
                            )}
                            {hoveredNodesAndNeighbors.length > 0 && (
                                <HoverLayer
                                    hoveredNodes={hoveredNodesAndNeighbors}
                                    hoveredEdges={hoveredEdges}
                                    coords={coords}
                                    nodes={nodes}
                                    edgeBundlePoints={ebp}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                    width={canvasW}
                                    height={canvasH}
                                />
                            )}
                            {this.state.brushedArea && (
                                <Layer>
                                    <Rect
                                        {...this.state.brushedArea}
                                        fill="blue"
                                        opacity={0.3}
                                        stroke="grey"
                                        strokeWidth={1}
                                    />
                                </Layer>
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
    nodeSize: state.param.nodeSize,
    useEdgeBundling: state.param.focalGraph.useEdgeBundling,
    nodeColors: state.nodeColors,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    highlightedEdges: state.highlightedEdges,
    hoveredNodesAndNeighbors: state.hoveredNodesAndNeighbors,
    hoveredEdges: state.hoveredEdges,
    onlyActivateOne: state.param.onlyActivateOne,
    highlightNodeType: state.param.highlightNodeType,
    highlightNodeLabel: state.param.highlightNodeLabel,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
            selectNodePair,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(GraphLayout);

function BaseLayerUnconnected({
    nodes,
    edges,
    coords,
    edgeBundlePoints,
    nodeColors,
    groups,
    hoverNode,
    highlightNodes,
    nodeSize,
}) {
    console.log("GraphLayout BaseLayer render()");
    const debouncedHover = useCallback(debounce((x) => hoverNode(x), 300));

    return (
        <Layer>
            <Group>
                {edges.map(
                    (e, i) =>
                        coords[e.source] &&
                        coords[e.target] && (
                            <Line
                                key={i}
                                points={
                                    edgeBundlePoints
                                        ? edgeBundlePoints[i]
                                        : [
                                              coords[e.source].x,
                                              coords[e.source].y,
                                              coords[e.target].x,
                                              coords[e.target].y,
                                          ]
                                }
                                stroke="#aaa"
                                strokeWidth={1}
                                hitStrokeWidth={2}
                                opacity={edgeBundlePoints ? 0.3 : 0.3}
                                tension={edgeBundlePoints ? 0.5 : 0}
                                onMouseOver={debouncedHover.bind(null, [e.source, e.target])}
                                onMouseOut={debouncedHover.bind(null, null)}
                                onClick={highlightNodes.bind(
                                    null,
                                    [e.source, e.target],
                                    null,
                                    "graph-edge",
                                    null
                                )}
                            />
                        )
                )}
            </Group>
            <Group>
                {coords.map(
                    (c, i) =>
                        c && (
                            <NodeRep
                                key={i}
                                x={c.x}
                                y={c.y}
                                radius={nodeSize}
                                typeId={nodes[i].typeId}
                                style={{ fill: nodeColors[i], opacity: 1, strokeEnabled: false }}
                                events={{
                                    onMouseOver: debouncedHover.bind(null, i),
                                    onMouseOut: debouncedHover.bind(null, null),
                                    onClick: highlightNodes.bind(null, [i], null, "graph-layout", null),
                                }}
                            />
                        )
                )}
            </Group>
            {groups && (
                <Group>
                    {groups.map((g, i) => (
                        <Group key={i}>
                            <Rect
                                x={g.bounds.x}
                                y={g.bounds.y}
                                width={g.bounds.width}
                                height={g.bounds.height}
                                stroke="black"
                                strokeWidth={1}
                                dash={[2, 2]}
                                fillEnabled={false}
                            />
                            <Text
                                text={`${g.name} (#=${g.num})`}
                                x={g.bounds.x + 2}
                                y={g.bounds.y + 2}
                                fontSize={12}
                            />
                        </Group>
                    ))}
                </Group>
            )}
        </Layer>
    );
}

const mapStateToPropsBaseLayer = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    nodeSize: state.param.nodeSize,
    onlyActivateOne: state.param.onlyActivateOne,
    nodeColors: state.nodeColors,
});

const BaseLayer = connect(mapStateToPropsBaseLayer, mapDispatchToProps)(BaseLayerUnconnected);
