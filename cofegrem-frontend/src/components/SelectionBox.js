import React, {Component} from 'react';

const initState = {
    mouseDown: false,
    startPoint: null,       // page x and y of starting point
    endPoint: null,
    selectionBox: null,     // Coordinates for the selection box
    appendMode: false,
};

class SelectionBox extends Component {
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
        this.props.selectedFunc(null, selectionBox, appendMode);
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
        const {selectionBox} = this.state;
        return (
            <g>
                {selectionBox != null &&
                <rect x={selectionBox.x} y={selectionBox.y}
                      width={selectionBox.width} height={selectionBox.height}
                      style={{stroke: '#ccc', strokeWidth: '1px', fill: 'blue', fillOpacity: '.3'}}
                />}

                <rect x={0} y={0} width={this.props.width} height={this.props.height}
                      ref={this.boxRef}
                      onMouseDown={this._onMouseDown.bind(this)}
                      style={{fill: '#fff', stroke: 'none', fillOpacity: 0}} />
            </g>
        );
    }
}

export default SelectionBox;
