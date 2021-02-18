import React, { Component, useCallback } from "react";
import { connect, ReactReduxContext, Provider } from "react-redux";
import { bindActionCreators } from "redux";
import { Stage, Layer, Group, Rect, Line } from "react-konva";
import debounce from "lodash.debounce";
import NodeRep from "./NodeRep";
import { FocusLayer, HighlightLayer, HoverLayer } from "./NodeLayers";
import { highlightNodes, hoverNode, selectNodePair } from "../actions";
import { isPointInBox } from "../utils";

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
        const { qt } = this.props.layoutData;
        const candidates = qt.retrieve(brushedArea);
        const targetNodes = [];
        for (let c of candidates) {
            if (isPointInBox({ x: c.x + 0.5, y: c.y + 0.5 }, brushedArea)) {
                targetNodes.push(c.id);
            }
        }
        console.log({ candidates, targetNodes, brushedArea });
        if (targetNodes.length == 0) return;

        this.props.highlightNodes(targetNodes, brushedArea, "focal-layout", null);
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
            spec,
            nodeSize,
            selectedNodes,
            highlightedNodes,
            highlightedEdges,
            hoveredNeighbors,
            hoveredEdges,
        } = this.props;
        const { width, height, coords, groups, qt } = layoutData;
        const canvasW = width + spec.margin,
            canvasH = height + spec.margin;
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
                            <BaseLayer coords={coords} groups={groups} />

                            {selectedNodes.length > 0 && (
                                <FocusLayer
                                    focalGroups={selectedNodes}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                />
                            )}
                            {highlightedNodes.length > 0 && (
                                <HighlightLayer
                                    highlightedNodes={highlightedNodes}
                                    highlightedEdges={highlightedEdges}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
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
                                    nodeSize={nodeSize}
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
    spec: state.spec.graph,
    nodeSize: state.param.nodeSize,
    nodeColors: state.nodeColors,
    selectedNodes: state.selectedNodes,
    highlightedNodes: state.highlightedNodes,
    highlightedEdges: state.highlightedEdges,
    hoveredNeighbors: state.hoveredNeighbors,
    hoveredEdges: state.hoveredEdges,
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
                        onMouseOver={debouncedHover.bind(null, [e.source, e.target])}
                        onMouseOut={debouncedHover.bind(null, null)}
                        onClick={highlightNodes.bind(null, [e.source, e.target], null, "graph-edge", null)}
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
                            onMouseOver: debouncedHover.bind(null, i),
                            onMouseOut: debouncedHover.bind(null, null),
                            onClick: highlightNodes.bind(null, [i], null, "graph-node", null),
                        }}
                    />
                ))}
            </Group>
        </Layer>
    );
}

const mapStateToPropsBaseLayer = (state) => ({
    nodes: state.graph.nodes,
    edges: state.graph.edges,
    nodeSize: state.param.nodeSize,
    nodeColors: state.nodeColors,
});

const BaseLayer = connect(mapStateToPropsBaseLayer, mapDispatchToProps)(BaseLayerUnconnected);
