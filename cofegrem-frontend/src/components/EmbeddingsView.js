import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';


class EmbeddingsView extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>

            </div>
        );
    }
}

const mapStateToProps = state => ({});

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
