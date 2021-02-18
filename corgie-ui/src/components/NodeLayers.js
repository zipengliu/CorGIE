
import React, { memo, PureComponent } from "react";
import { Layer, Group, Line, Rect, Text } from "react-konva";
import { Animation } from "konva";
import NodeRep from "./NodeRep";

// Visual encoding for focal nodes: black strokes
// Note that focalGroups is an array of array
export const FocusLayer = memo(({ focalGroups, nodes, coords, focalBBox, nodeSize }) => (
    <Layer listening={false}>
        <Group>
            {!!focalBBox && focalBBox.map((h, i) => (
                <Group key={i}>
                    <Text x={h.x} y={h.y - 10} text={`foc-${i}`} fontSize={12} />
                    <Rect {...h} stroke="#ccc" strokeWidth={1} fill="blue" opacity={0.3} />
                </Group>
            ))}
        </Group>
        {focalGroups.map((g, gIdx) => (
            <Group key={gIdx}>
                {g.map((nodeIdx, i) => (
                    <NodeRep
                        key={i}
                        x={coords[nodeIdx].x}
                        y={coords[nodeIdx].y}
                        radius={nodeSize}
                        typeId={nodes[nodeIdx].typeId}
                        style={{ fillEnabled: false, stroke: "black", strokeWidth: 1 }}
                    />
                ))}
            </Group>
        ))}
    </Layer>
));

export class HighlightLayer extends PureComponent {
    // componentDidMount() {
    //     const period = 200;

    //     this.anim = new Animation((frame) => {
    //         this.layer.opacity((Math.sin(frame.time / period) + 1) / 2);
    //     }, this.layer);

    //     this.anim.start();
    // }
    // componentWillUnmount() {
    //     if (this.anim) {
    //         this.anim.stop();
    //     }
    // }
    render() {
        const { highlightedNodes, highlightedEdges, nodes, coords, nodeSize } = this.props;
        return (
            <Layer
                listening={false}
                ref={(node) => {
                    this.layer = node;
                }}
            >
                <Group>
                    {!!highlightedEdges && highlightedEdges.map((e, i) => (
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
                            opacity={0.5}
                        />
                    ))}
                </Group>
                <Group>
                    {highlightedNodes.map((nodeIdx, i) => (
                        <NodeRep
                            key={i}
                            x={coords[nodeIdx].x}
                            y={coords[nodeIdx].y}
                            radius={nodeSize * 1.5}
                            typeId={nodes[nodeIdx].typeId}
                            style={{ fillEnabled: false, stroke: "black", strokeWidth: 2 }}
                        />
                    ))}
                </Group>
            </Layer>
        );
    }
}

export const HoverLayer = memo(
    ({ hoveredNodes, hoveredEdges, nodes, coords, nodeColors, nodeSize, width, height }) => (
        <Layer listening={false}>
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="white"
                opacity={0.8}
                strokeEnabled={false}
            />
            <Group>
                {!!hoveredEdges && hoveredEdges.map((e, i) => (
                    <Line
                        key={i}
                        points={[
                            coords[e.source].x,
                            coords[e.source].y,
                            coords[e.target].x,
                            coords[e.target].y,
                        ]}
                        stroke="black"
                        strokeWidth={1}
                        opacity={0.5}
                    />
                ))}
            </Group>
            <Group>
                {hoveredNodes.map((nodeIdx, i) => (
                    <NodeRep
                        key={i}
                        x={coords[nodeIdx].x}
                        y={coords[nodeIdx].y}
                        radius={nodeSize}
                        typeId={nodes[nodeIdx].typeId}
                        style={{ fill: nodeColors[i], strokeEnabled: false }}
                    />
                ))}
            </Group>
        </Layer>
    )
);