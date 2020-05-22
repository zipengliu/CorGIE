import React, { Component } from "react";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import cn from "classnames";
import { scaleLinear, max, scaleSequential, interpolateBlues } from "d3";
import { highlightNodes } from "../actions";
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
        const rollUpSvgWidth = 
                selectedNeighByHop[0].length * (colWidth + gap) * 2 +
                labelAreaSize +
                margins.left +
                margins.right;
        const svgWidth =
                Object.keys(neighMapping).length * (colWidth + gap) +
                labelAreaSize +
                margins.left +
                margins.right,
            svgHeight =
                selectedNodes.length * (rowHeight + gap) +
                labelAreaSize +
                countBarHeight +
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

        return (
            <div id="adjacency-matrix-view" className="view">
                <h5>Adjacency matrix of selected nodes</h5>

                <p>
                    Roll-up matrix for selected nodes and 1-hop neighbors. Neighbors are grouped and sorted by
                    #selected nodes they connect to.
                </p>
                <svg width={rollUpSvgWidth} height={svgHeight}>
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

                                    {/* cells */}
                                    <g transform={`translate(0,${gap})`}>
                                        {selectedNodes.map((selectedId, i) => (
                                            <g key={i} transform={`translate(0,${i * (rowHeight + gap)})`}>
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
                <svg width={svgWidth} height={svgHeight}>
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
                                <g key={grpIdx}>
                                    {grp.nodes.map((neighId, i) => (
                                        <g
                                            key={i}
                                            transform={`translate(${
                                                (grp.prevTotal + i) * (colWidth + gap)
                                            },0)`}
                                        >
                                            <g transform={`translate(${colWidth / 2},0)`}>
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
                                                {grp.isBoundary[neighId] && (
                                                    <line
                                                        x1={-(colWidth + gap) / 2}
                                                        y1={-30 - (i === 0 ? 50 : 0)}
                                                        x2={-(colWidth + gap) / 2}
                                                        y2={
                                                            labelSize / 2 +
                                                            selectedNodes.length * (rowHeight + gap) +
                                                            (i === 0 ? 50 : 20)
                                                        }
                                                        style={{ stroke: i === 0? 'black': 'grey' }}
                                                    />
                                                )}
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
                                        </g>
                                    ))}
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
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(AdjacencyMatrix);
