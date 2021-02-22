import React, { Component, memo, useCallback } from "react";
import { connect, ReactReduxContext, Provider } from "react-redux";
import { bindActionCreators } from "redux";
import { Stage, Layer, Group, Rect } from "react-konva";
import debounce from "lodash.debounce";
import NodeRep from "./NodeRep";
import { FocusLayer, HighlightLayer, HoverLayer } from "./NodeLayers";
import { getNodeEmbeddingColor } from "../utils";
import { highlightNodes, hoverNode } from "../actions";
import { isPointInBox } from "../utils";

const initState = {
    mouseDown: false,
    startPoint: null, // page x and y of starting point
    endPoint: null,
    brushedArea: null, // Coordinates for the brushed area
};

class Embeddings2D extends Component {
    constructor(props) {
        super(props);
        this.stageRef = React.createRef();
        this.state = initState;
    }
    callHighlightNodes(brushedArea) {
        const { nodes, selectedNodeType } = this.props;
        const candidates = this.props.qt.retrieve(brushedArea);
        const targetNodes = [];
        for (let c of candidates) {
            if (
                nodes[c.id].typeId === selectedNodeType &&
                isPointInBox({ x: c.x + 0.5, y: c.y + 0.5 }, brushedArea)
            ) {
                targetNodes.push(c.id);
            }
        }
        // if (targetNodes.length == 0) return;

        this.props.highlightNodes(targetNodes, brushedArea, "emb", null);
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
            nodes,
            coords,
            spec,
            nodeSize,
            nodeColors,
            colorBy,
            selectedNodes,
            selBoundingBox,
            highlightedNodes,
            hoveredNeighbors,
        } = this.props;
        return (
            <ReactReduxContext.Consumer>
                {({ store }) => (
                    // Implement the brush here
                    <Stage
                        width={spec.width}
                        height={spec.height}
                        ref={this.stageRef}
                        onMouseDown={this._onMouseDown.bind(this)}
                    >
                        <Provider store={store}>
                            {colorBy === -1 && <ColorTiles w={spec.width} />}
                            <BaseLayer />
                            {selectedNodes.length > 0 && (
                                <FocusLayer
                                    focalGroups={selectedNodes}
                                    focalBBox={selBoundingBox}
                                    nodes={nodes}
                                    coords={coords}
                                    nodeSize={nodeSize}
                                />
                            )}
                            {highlightedNodes.length > 0 && (
                                <HighlightLayer
                                    highlightedNodes={highlightedNodes}
                                    highlightedEdges={null}
                                    coords={coords}
                                    nodes={nodes}
                                    nodeColors={nodeColors}
                                    nodeSize={nodeSize}
                                />
                            )}
                            {hoveredNeighbors.length > 0 && (
                                <HoverLayer
                                    width={spec.width}
                                    height={spec.height}
                                    hoveredNodes={hoveredNeighbors}
                                    hoveredEdges={null}
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
    coords: state.latent.coords,
    qt: state.latent.qt,
    spec: state.spec.latent,
    nodeColors: state.nodeColors,
    colorBy: state.param.colorBy,
    selectedNodes: state.selectedNodes,
    selectedNodeType: state.param.latent.selectedNodeType,
    selBoundingBox: state.selBoundingBox,
    highlightedNodes: state.highlightedNodes,
    hoveredNeighbors: state.hoveredNeighbors,
    nodeSize: state.param.nodeSize - 1,
});

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            hoverNode,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(Embeddings2D);

function BaseLayerUnconnected({ nodeColors, colorBy, nodeSize, coords, nodes, hoverNode, highlightNodes }) {
    console.log("Embeddings2D BaseLayer render()");
    const debouncedHover = useCallback(debounce((i) => hoverNode(i), 300));

    return (
        <Layer>
            <Group>
                {coords.map((c, i) => (
                    <NodeRep
                        key={i}
                        x={c.x}
                        y={c.y}
                        radius={nodeSize}
                        typeId={nodes[i].typeId}
                        style={{
                            fill: colorBy === -1 ? "grey" : nodeColors[i],
                            strokeEnabled: false,
                        }}
                        events={{
                            onMouseOver: debouncedHover.bind(null, i),
                            onMouseOut: debouncedHover.bind(null, null),
                            onClick: highlightNodes.bind(null, [i], null, "emb", null),
                        }}
                    />
                ))}
            </Group>
        </Layer>
    );
}

const mapStateToPropsBaseLayer = (state) => ({
    nodes: state.graph.nodes,
    coords: state.latent.coords,
    nodeSize: Math.max(state.param.nodeSize - 1, 1),
    nodeColors: state.nodeColors,
    colorBy: state.param.colorBy,
});

const BaseLayer = connect(mapStateToPropsBaseLayer, mapDispatchToProps)(BaseLayerUnconnected);

const ColorTiles = memo(({ w }) => {
    const unitSize = 4,
        num = w / unitSize;
    const tileArr = new Array(num).fill(0);
    return (
        <Layer listening={false}>
            {tileArr.map((_, i) => (
                <Group key={i}>
                    {tileArr.map((_, j) => (
                        <Rect
                            key={j}
                            x={i * unitSize}
                            y={j * unitSize}
                            width={unitSize}
                            height={unitSize}
                            fill={getNodeEmbeddingColor(i / num, j / num)}
                            strokeEnabled={false}
                        />
                    ))}
                </Group>
            ))}
        </Layer>
    );
});
