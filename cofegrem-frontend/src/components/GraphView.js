import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import cn from 'classnames';
import './GraphView.css';
import {highlightNodes, highlightNodeType, selectNodes} from '../actions';

class GraphView extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const {spec, graph, isNodeHighlighted, isNodeSelected} = this.props;
        const {width, height, margins} = spec.graph;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const {coords, nodes, edges, nodeTypes} = graph;

        return (
            <div id="graph-view">
                <div className="graph-info">
                    <div>
                        Number of nodes: {nodes.length},
                        number of edges: {edges.length}
                    </div>
                    <div>
                        <span style={{marginLeft: '5px'}}>
                            {nodeTypes.length} node types:
                        </span>
                        {nodeTypes.map((nt, i) =>
                            <div key={i} className="node-type-legend"
                                 onMouseEnter={this.props.highlightNodeType.bind(this, i)}
                                 onMouseLeave={this.props.highlightNodeType.bind(this, null)}>
                                <div className="emu-circle" style={{backgroundColor: nt.color}} />
                                {nt.name}: {nt.count}
                            </div>)}
                    </div>
                </div>

                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <g className="edges">
                            {edges.map((e, i) =>
                                <line key={i} className="edge" x1={e.source.x} y1={e.source.y}
                                      x2={e.target.x} y2={e.target.y}/>
                            )}
                        </g>

                        <g className="nodes">
                            {coords.map((c, i) =>
                                <circle key={i}
                                        className={cn('node', {highlighted: isNodeHighlighted !== null && isNodeHighlighted[i],
                                            selected: isNodeSelected[i]})}
                                        onMouseEnter={this.props.highlightNodes.bind(null, i)}
                                        onMouseLeave={this.props.highlightNodes.bind(null, null)}
                                        onClick={this.props.selectNodes.bind(null, i)}
                                        cx={c.x} cy={c.y} r={5}
                                        style={{fill: nodeTypes[nodes[i].typeId].color}} />
                            )}
                        </g>
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({
    highlightNodes, highlightNodeType, selectNodes
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
