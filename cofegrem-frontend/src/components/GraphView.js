import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import cn from 'classnames';
import './GraphView.css';
import {highlightNodes, highlightNodeType} from '../actions';

class GraphView extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const {spec, graph, dataRows, highlightedNodes, highlightedType, showDetailNode} = this.props;
        const {width, height, margins} = spec.graph;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const {colorScheme, coords, nodes, edges, countsByType} = graph;
        const counts = Object.keys(countsByType).map(t => ({type: t, count: countsByType[t]}));

        // Construct an array of whether each node should be highlighted
        let highlighted = (new Array(nodes.length)).fill(false);
        if (highlightedType !== null) {
            highlighted = nodes.map(n => n.type === highlightedType);
        } else {
            if (highlightedNodes.length > 0) {
                for (let h of highlightedNodes) {
                    highlighted[h] = true;
                }
            }
        }

        return (
            <div id="graph-view">
                <div className="graph-info">
                    <div>
                        Number of nodes: {nodes.length},
                        number of edges: {edges.length}
                    </div>
                    <div>
                        <span style={{marginLeft: '5px'}}>
                            {counts.length} node types:
                        </span>
                        {counts.map((c, i) =>
                            <div key={i} className="node-type-legend"
                                 onMouseEnter={this.props.highlightNodeType.bind(this, c.type)}
                                 onMouseLeave={this.props.highlightNodeType.bind(this, null)}>
                                <div className="emu-circle" style={{backgroundColor: colorScheme[c.type]}} />
                                {c.type}: {c.count}
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
                                <circle key={i} className={cn('node', {'highlighted': highlighted[i]})}
                                        onMouseEnter={this.props.highlightNodes.bind(this, i)}
                                        onMouseLeave={this.props.highlightNodes.bind(this, null)}
                                        cx={c.x} cy={c.y} r={5}
                                        style={{fill: colorScheme[nodes[i].type]}} />
                            )}
                        </g>
                    </g>
                </svg>

                <div className="node-detail">
                    {showDetailNode !== null && renderNodeDetail(nodes[showDetailNode])}
                </div>
            </div>
        );
    }
}

function renderNodeDetail(info) {
    return (
        <div>
            <span>Type: {info.type}</span>
            <span>Label: {info.label}</span>
        </div>
    )
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({
    highlightNodes, highlightNodeType
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GraphView);
