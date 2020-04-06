import React, { Component } from 'react'
import { connect } from 'react-redux'
import {bindActionCreators} from 'redux';

export class GlobalControls extends Component {
    render() {
        return (
            <div id="global-controls">
                
            </div>
        )
    }
}

const mapStateToProps = (state) => ({
    ...state
})

const mapDispatchToProps = dispatch => bindActionCreators({
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(GlobalControls)
