import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import cn from 'classnames';
import './EmbeddingsView.css';
import {highlightNodes, selectNodes} from '../actions';

const initState = {
    mouseDown: false,
    startPoint: null,       // page x and y of starting point
    endPoint: null,
    selectionBox: null,     // Coordinates for the selection box
    appendMode: false,
};


class EmbeddingsView extends Component {
    constructor(props) {
        super(props);
        this.boxRef = React.createRef();
        // The UI state for the drag selection
        this.state = initState;
    }

    _onMouseDown(e) {
        let nextState = {
            mouseDown: true,
            startPoint: {x: e.pageX, y: e.pageY},
            mouseMoveFunc: this._onMouseMove.bind(this),
            mouseUpFunc: this._onMouseUp.bind(this)
        };
        if (e.shiftKey) {
            nextState.appendMode = true;
        }
        this.setState(nextState);
        window.document.addEventListener('mousemove', nextState.mouseMoveFunc);
        window.document.addEventListener('mouseup', nextState.mouseUpFunc);
    }

    _onMouseUp(e) {
        window.document.removeEventListener('mousemove', this.state.mouseMoveFunc);
        window.document.removeEventListener('mouseup', this.state.mouseUpFunc);
        const selectionBox = {...this.state.selectionBox};
        const {appendMode} = this.state;
        this.setState(initState);
        this.props.selectNodes(null, selectionBox, appendMode);
    }

    _onMouseMove(e) {
        e.preventDefault();
        if (this.state.mouseDown) {
            let endPoint = {x: e.pageX, y: e.pageY};
            this.setState({
                endPoint,
                selectionBox: this._calcSelectionBox(this.state.startPoint, endPoint)
            })
        }
    }

    _calcSelectionBox(startPoint, endPoint) {
        if (!this.state.mouseDown || startPoint == null || endPoint == null) {
            return null;
        }
        const parentNode = this.boxRef.current;
        const rect = parentNode.getBoundingClientRect();
        const x = Math.min(startPoint.x, endPoint.x) - (rect.left + window.scrollX);
        const y = Math.min(startPoint.y, endPoint.y) - (rect.top + window.scrollY);
        const width = Math.abs(startPoint.x - endPoint.x);
        const height = Math.abs(startPoint.y - endPoint.y);
        // console.log({rect, startPoint, endPoint, x, y});
        return {
            x,
            y,
            width,
            height,
        };
    }

    render() {
        // console.log('rendering EmbeddingView...', this.state.selectionBox);
        const {spec, latent, graph, isNodeHighlighted, isNodeSelected} = this.props;
        const {width, height, margins} = spec.latent;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const {coords} = latent;
        const {nodes, nodeTypes} = graph;
        const {selectionBox} = this.state;

        return (
            <div id="embeddings-view">
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <rect x={-margins.left / 2} y={-margins.top / 2} width={width + (margins.left + margins.right) / 2}
                              height={height + (margins.top + margins.bottom) / 2}
                              style={{stroke: '#000', strokeWidth: '1px', fill: 'none'}}/>
                        <g className="points">
                            {coords.map((c, i) =>
                                <circle key={i}
                                        className={cn('point', {highlighted: isNodeHighlighted !== null && isNodeHighlighted[i],
                                            selected: isNodeSelected[i]})}
                                        cx={c.x} cy={c.y} r={3}
                                        onMouseEnter={this.props.highlightNodes.bind(this, i)}
                                        onMouseLeave={this.props.highlightNodes.bind(this, null)}
                                        onClick={this.props.selectNodes.bind(null, i)}
                                        style={{fill: nodeTypes[nodes[i].typeId].color}}/>
                            )}
                        </g>

                        {selectionBox != null &&
                        <rect id='selection-box' x={selectionBox.x} y={selectionBox.y}
                              width={selectionBox.width} height={selectionBox.height} />}

                        <rect x={0} y={0} width={width} height={height}
                              ref={this.boxRef}
                              onMouseDown={this._onMouseDown.bind(this)}
                              style={{fill: '#fff', stroke: 'none', fillOpacity: 0}} />
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({
    highlightNodes, selectNodes,
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
