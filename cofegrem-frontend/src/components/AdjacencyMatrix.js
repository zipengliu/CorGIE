import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { scaleLinear, max, scaleSequential, interpolateBlues, interpolateGreens } from "d3";
import { highlightNodes, highlightNeighbors } from "../actions";
import NodeRep from "./NodeRep";

class AdjacencyMatrix extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //
    render() {
        const {
            graph,
            selectedNodes,
            isNodeHighlighted,
            isNodeSelected,
            isNodeSelectedNeighbor,
            selectedNeighByHop,
            neighMapping,
        } = this.props;
        const { nodes, nodeTypes, neighborMasks } = graph;
        const spec = this.props.spec.adjacencyMatrix;
        const {
            margins,
            rowHeight,
            colWidth,
            gap,
            histogramAreaHeight,
            histogramHeight,
            labelHeight,
            labelAreaSize,
            labelSize,
            countAreaSize,
            countBarHeight,
        } = spec;
        const { centralNodeSize, auxNodeSize } = this.props.spec.graph;
        const numNeighbors = Object.keys(neighMapping).length;
        const rollUpSvgWidth =
                selectedNeighByHop[0].length * (colWidth + gap) * 2 +
                labelAreaSize +
                margins.left +
                margins.right,
            rollUpSvgHeight =
                selectedNodes.length * (rowHeight + gap) +
                labelAreaSize +
                countBarHeight +
                margins.top +
                margins.bottom;
        const fullSvgWidth = numNeighbors * (colWidth + gap) + labelAreaSize + margins.left + margins.right,
            fullSvgHeight =
                labelAreaSize +
                selectedNodes.length * (rowHeight + gap) +
                50 +
                numNeighbors * (rowHeight + gap) +
                margins.top +
                margins.bottom;

        // Find the max number in the count matrix
        let maxCount = 1,
            maxNeighGrp = 1;
        for (let grp of selectedNeighByHop[0]) {
            for (let selectedId of selectedNodes) {
                maxCount = Math.max(grp.cntsPerSelected[selectedId], maxCount);
            }
            maxNeighGrp = Math.max(grp.nodes.length, maxNeighGrp);
        }
        const colorScale = scaleSequential(interpolateBlues).domain([0, maxCount]);

        // The y-scale for the historgram on top of the roll-up matrix
        const numNeighScale = scaleLinear().domain([0, maxNeighGrp]).range([0, histogramHeight]);

        const hammingDistColorScale = scaleSequential(interpolateGreens).domain([
            0,
            selectedNodes.length + 1,
        ]);

        return (
            <div id="adjacency-matrix-view" className="view">
                <h5>Adjacency matrix of selected nodes</h5>

                <p>
                    Roll-up matrix for selected nodes and 1-hop neighbors. Neighbors are grouped and sorted by
                    #selected nodes they connect to.
                </p>
                <svg width={rollUpSvgWidth} height={rollUpSvgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {/*row labels*/}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize - 10},${histogramAreaHeight + gap + 10})`}
                        >
                            {selectedNodes.map((id, i) => (
                                <g
                                    key={i}
                                    transform={`translate(0,${i * (rowHeight + gap)})`}
                                    className={cn("node", {
                                        highlighted: isNodeHighlighted[id],
                                        selected: isNodeSelected[id],
                                        "hop-1": isNodeSelectedNeighbor[id] === 1,
                                        "hop-2": isNodeSelectedNeighbor[id] === 2,
                                    })}
                                    onMouseEnter={this.props.highlightNodes.bind(null, id)}
                                    onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                >
                                    <NodeRep
                                        shape={nodes[id].typeId === 0 ? "triangle" : "circle"}
                                        r={nodes[id].typeId === 0 ? centralNodeSize : auxNodeSize}
                                    />
                                    <text
                                        x={-labelSize}
                                        y={0}
                                        textAnchor="end"
                                        transform={`rotate(-30,${-labelSize},${0})`}
                                    >
                                        {nodes[id].label}
                                    </text>
                                </g>
                            ))}
                        </g>

                        {/* columns */}
                        <g className="labels" transform={`translate(${labelAreaSize + gap},0)`}>
                            {selectedNeighByHop[0].map((grp, grpIdx) => (
                                <g
                                    key={grpIdx}
                                    transform={`translate(${
                                        2 * grpIdx * (colWidth + gap)
                                    },${histogramAreaHeight})`}
                                >
                                    <g
                                        onMouseEnter={this.props.highlightNeighbors.bind(null, grp.nodes)}
                                        onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                    >
                                        <rect
                                            x={0}
                                            y={-labelHeight - numNeighScale(grp.nodes.length)}
                                            width={colWidth}
                                            height={numNeighScale(grp.nodes.length)}
                                            style={{ fill: "grey" }}
                                        />
                                        <text x={0} y={-labelHeight - numNeighScale(grp.nodes.length) - 2}>
                                            {grp.nodes.length}
                                        </text>
                                        <text x={0} y={0}>
                                            {grp.freq}
                                        </text>
                                    </g>

                                    {/* cells */}
                                    <g transform={`translate(0,${gap})`}>
                                        {selectedNodes.map((selectedId, i) => (
                                            <g
                                                key={i}
                                                transform={`translate(0,${i * (rowHeight + gap)})`}
                                                onMouseEnter={this.props.highlightNeighbors.bind(
                                                    null,
                                                    grp.nodesPerSelected[selectedId]
                                                )}
                                                onMouseLeave={this.props.highlightNeighbors.bind(null, null)}
                                            >
                                                <rect
                                                    x={0}
                                                    y={0}
                                                    width={colWidth}
                                                    height={rowHeight}
                                                    style={{
                                                        fill: colorScale(grp.cntsPerSelected[selectedId]),
                                                    }}
                                                />
                                                <text
                                                    y={10}
                                                    style={{
                                                        fill:
                                                            grp.cntsPerSelected[selectedId] < maxCount / 2
                                                                ? "black"
                                                                : "white",
                                                    }}
                                                >
                                                    {grp.cntsPerSelected[selectedId]}
                                                </text>
                                            </g>
                                        ))}
                                    </g>
                                </g>
                            ))}
                        </g>
                    </g>
                </svg>

                <p>Fully expanded matrix for selected nodes and 1-hop neighbors</p>
                <svg width={fullSvgWidth} height={fullSvgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {/*row labels*/}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize - labelSize / 2 - 4},${
                                labelAreaSize + labelSize / 2
                            })`}
                        >
                            {selectedNodes.map((id, i) => (
                                <g
                                    key={i}
                                    transform={`translate(0,${i * (rowHeight + gap)})`}
                                    className={cn("node", {
                                        highlighted: isNodeHighlighted[id],
                                        selected: isNodeSelected[id],
                                        "hop-1": isNodeSelectedNeighbor[id] === 1,
                                        "hop-2": isNodeSelectedNeighbor[id] === 2,
                                    })}
                                    onMouseEnter={this.props.highlightNodes.bind(null, id)}
                                    onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                >
                                    <NodeRep
                                        shape={nodes[id].typeId === 0 ? "triangle" : "circle"}
                                        r={nodes[id].typeId === 0 ? centralNodeSize : auxNodeSize}
                                    />
                                    <text
                                        x={-labelSize}
                                        y={0}
                                        textAnchor="end"
                                        transform={`rotate(30,${-labelSize},${0})`}
                                    >
                                        {nodes[id].label}
                                    </text>
                                </g>
                            ))}
                        </g>

                        {/*column labels */}
                        <g
                            className="labels"
                            transform={`translate(${labelAreaSize + labelSize / 2},${
                                labelAreaSize - labelSize / 2 - 4
                            })`}
                        >
                            {selectedNeighByHop[0].map((grp, grpIdx) => (
                                <g
                                    key={grpIdx}
                                    transform={`translate(${grp.prevTotal * (colWidth + gap)},0)`}
                                >
                                    <g transform={`translate(0,0)`}>
                                        <line
                                            className="group-line"
                                            x1={0}
                                            y1={-40}
                                            x2={grp.nodes.length * (colWidth + gap) - gap}
                                            y2={-40}
                                        />

                                        {grp.subgroups.map((subgrp, subgrpIdx) => (
                                            <line
                                                key={subgrpIdx}
                                                className="subgroup-line"
                                                x1={grp.subGroupPrevTotal[subgrpIdx] * (colWidth + gap)}
                                                y1={-30}
                                                x2={
                                                    (grp.subGroupPrevTotal[subgrpIdx] + subgrp.length) *
                                                        (colWidth + gap) -
                                                    gap
                                                }
                                                y2={-30}
                                            />
                                        ))}
                                    </g>

                                    {grp.nodes.map((neighId, i) => (
                                        <g key={i} transform={`translate(${i * (colWidth + gap)},0)`}>
                                            <g
                                                transform={`translate(${colWidth / 2},0)`}
                                                className={cn("node", {
                                                    highlighted: isNodeHighlighted[neighId],
                                                    selected: isNodeSelected[neighId],
                                                    "hop-1": isNodeSelectedNeighbor[neighId] === 1,
                                                    "hop-2": isNodeSelectedNeighbor[neighId] === 2,
                                                })}
                                                onMouseEnter={this.props.highlightNodes.bind(null, neighId)}
                                                onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                            >
                                                <NodeRep
                                                    shape={
                                                        nodes[neighId].typeId === 0 ? "triangle" : "circle"
                                                    }
                                                    r={
                                                        nodes[neighId].typeId === 0
                                                            ? centralNodeSize
                                                            : auxNodeSize
                                                    }
                                                />
                                                <text
                                                    x={2}
                                                    y={-labelSize}
                                                    transform={`rotate(-30,2,${-labelSize})`}
                                                >
                                                    {nodes[neighId].label}
                                                    {/* (node idx: {neighId}) */}
                                                </text>
                                                {/* {grp.isBoundary[neighId] && (
                                                    <line
                                                        x1={-(colWidth + gap) / 2}
                                                        y1={-30 - (i === 0 ? 50 : 0)}
                                                        x2={-(colWidth + gap) / 2}
                                                        y2={
                                                            labelSize / 2 +
                                                            selectedNodes.length * (rowHeight + gap) +
                                                            (i === 0 ? 50 : 20)
                                                        }
                                                        style={{ stroke: i === 0 ? "black" : "grey" }}
                                                    />
                                                )} */}
                                            </g>

                                            {/* cells */}
                                            <g transform={`translate(0,${labelSize / 2})`}>
                                                {selectedNodes.map((selectedId, j) => (
                                                    <rect
                                                        key={j}
                                                        className="cell"
                                                        x={0}
                                                        y={j * (rowHeight + gap)}
                                                        width={colWidth}
                                                        height={rowHeight}
                                                        style={{
                                                            fill: neighborMasks[selectedId].get(neighId)
                                                                ? "#000"
                                                                : "#ccc",
                                                        }}
                                                    />
                                                ))}
                                            </g>

                                            {/* Hamming distance cells */}
                                            <g
                                                transform={`translate(0,${
                                                    selectedNodes.length * (rowHeight + gap) + 20
                                                })`}
                                            >
                                                {selectedNeighByHop[0].map((grp2, grp2idx) => (
                                                    <g key={grp2idx}>
                                                        {grp2.nodes.map((neighId2, i2) => (
                                                            <rect
                                                                key={i2}
                                                                className="cell"
                                                                x={0}
                                                                y={(grp2.prevTotal + i2) * (rowHeight + gap)}
                                                                width={colWidth}
                                                                height={rowHeight}
                                                                style={{
                                                                    fill: hammingDistColorScale(
                                                                        selectedNodes.length -
                                                                            neighMapping[neighId].mask
                                                                                .xor(
                                                                                    neighMapping[neighId2]
                                                                                        .mask
                                                                                )
                                                                                .cardinality() +
                                                                            1
                                                                    ),
                                                                }}
                                                            />
                                                        ))}
                                                    </g>
                                                ))}
                                            </g>
                                        </g>
                                    ))}
                                </g>
                            ))}
                        </g>

                        {/* legends */}
                        <g>
                            <text x={0} y={labelAreaSize + selectedNodes.length * (rowHeight + gap) + 10}>
                                Hamming distances:
                            </text>
                        </g>

                        <g
                            transform={`translate(${labelAreaSize},${
                                (selectedNodes.length + numNeighbors) * (rowHeight + gap) + 40 + labelAreaSize
                            })`}
                        >
                            <text x={-labelAreaSize}>Hamming dist. legends:</text>
                            {selectedNodes.map((_, i) => (
                                <g key={i} transform={`translate(${i * (colWidth + gap)},0)`}>
                                    <rect
                                        x={0}
                                        y={0}
                                        width={colWidth}
                                        height={rowHeight}
                                        style={{ fill: hammingDistColorScale(selectedNodes.length - i + 1) }}
                                    />
                                    <text x={2} y={10}>
                                        {i}
                                    </text>
                                </g>
                            ))}
                        </g>
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({ ...state });

const mapDispatchToProps = (dispatch) =>
    bindActionCreators(
        {
            highlightNodes,
            highlightNeighbors,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(AdjacencyMatrix);
