import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import cn from 'classnames';
import {scaleLinear, max} from 'd3';
import {highlightNodes} from '../actions';
import SharedCountHistogram from "./SharedCountHistogram";


class AdjacencyMatrix extends Component {
    // constructor(props) {
    //     super(props);
    // }
    //
    render() {
        const {neighborCounts, graph, selectedNodes, isNodeHighlighted, isNodeSelected} = this.props;
        const {nodes, nodeTypes, neighborMasks} = graph;
        const spec = this.props.spec.adjacencyMatrix;
        const {margins, rowHeight, colWidth, gap, labelAreaSize, labelSize, countAreaSize, countBarHeight} = spec;
        const svgWidth = neighborCounts.length * (colWidth + gap) + labelAreaSize + countAreaSize  + margins.left + margins.right,
            svgHeight = selectedNodes.length * (rowHeight + gap) + labelAreaSize + countAreaSize + countBarHeight +  margins.top + margins.bottom;

        const cntScale = scaleLinear().domain([0, max(neighborCounts.map(c => c.cnt))+1]).range([0, countBarHeight]);

        return (
            <div id="adjacency-matrix-view">
                <h5>Adjacency matrix of selected nodes</h5>
                <div style={{fontSize: '14px'}}>(row: neighbor sets of selected nodes; column: neighbor nodes sorted by node type)</div>
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        {/*row labels*/}
                        <g className="labels" transform={`translate(${labelAreaSize - labelSize/2 - 4},${labelAreaSize + labelSize/2})`}>
                            {selectedNodes.map((id, i) =>
                                <g key={i} transform={`translate(0,${i*(rowHeight+gap)})`}>
                                    <circle className={cn("node selected",{highlighted: isNodeHighlighted[id]})}
                                            onMouseEnter={this.props.highlightNodes.bind(null, id)}
                                            onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                            cx={0} cy={0} r={labelSize / 2}
                                            style={{fill: nodeTypes[nodes[id].typeId].color}} />
                                    <text x={-labelSize} y={0} textAnchor='end' transform={`rotate(30,${-labelSize},${0})`} >
                                        {nodes[id].label}
                                    </text>
                                </g>
                            )}
                            <text x={0} y={selectedNodes.length*(rowHeight+gap) + 4} textAnchor='end'>
                                Freq. in neighbor sets
                            </text>
                        </g>
                        {/*column labels */}
                        <g className="labels" transform={`translate(${labelAreaSize + labelSize/2},${labelAreaSize - labelSize/2 - 4})`}>
                            {neighborCounts.map((neigh, i) =>
                                <g key={i} transform={`translate(${i * (colWidth+ gap)},0)`}>
                                    <circle className={cn('node', {highlighted: isNodeHighlighted[neigh.id],
                                        selected: isNodeSelected[neigh.id]})}
                                            onMouseEnter={this.props.highlightNodes.bind(null, neigh.id)}
                                            onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                            cx={0} cy={0} r={labelSize / 2}
                                            style={{fill: nodeTypes[nodes[neigh.id].typeId].color}} />
                                    <text x={2} y={-labelSize} transform={`rotate(-30,2,${-labelSize})`} >
                                        {nodes[neigh.id].label}
                                    </text>
                                </g>
                            )}
                            <text x={neighborCounts.length*(colWidth+gap)} y={labelSize / 2}>Degree</text>
                        </g>

                        {/*cell*/}
                        <g transform={`translate(${labelAreaSize},${labelAreaSize})`}>
                            {selectedNodes.map((selectedId, i) =>
                                <g key={i} transform={`translate(0,${i*(rowHeight+gap)})`}>
                                    {neighborCounts.map((neigh, j) =>
                                        <rect key={j} className="cell"
                                              x={j*(colWidth+gap)} y={0} width={colWidth} height={rowHeight}
                                              style={{fill: neighborMasks[selectedId].get(neigh.id)? '#000': '#ccc'}}
                                        />
                                    )}
                                </g>
                            )}
                        </g>

                        {/*last row: total*/}
                        <g transform={`translate(${labelAreaSize},${labelAreaSize+selectedNodes.length*(rowHeight+gap)})`}>
                            {neighborCounts.map((neigh, j) =>
                                <g key={j} transform={`translate(${j*(colWidth+gap)},0)`}>
                                    <text x={4} y={10}>{neigh.cnt}</text>
                                    <rect className='bar' x={0} y={15} width={colWidth} height={cntScale(neigh.cnt)}
                                          style={{fill: nodeTypes[nodes[neigh.id].typeId].color}}
                                          onMouseEnter={this.props.highlightNodes.bind(null, neigh.id)}
                                          onMouseLeave={this.props.highlightNodes.bind(null, null)} />
                                </g>
                            )}
                        </g>

                        {/*last column: degree*/}
                        <g transform={`translate(${labelAreaSize+neighborCounts.length*(colWidth+gap)},${labelAreaSize})`}>
                            {selectedNodes.map((id, i) =>
                                <text key={i} x={2} y={i*(rowHeight+gap)+10}>{neighborMasks[id].cardinality()}</text>
                            )}
                        </g>
                    </g>
                </svg>

                <h5>Histogram of frequencies of neighbor nodes in selected neighbor sets (counts of counts)</h5>
                <SharedCountHistogram />
            </div>
        );
    }
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({
    highlightNodes,
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(AdjacencyMatrix);
