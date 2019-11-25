import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import './EmbeddingsView.css';


class EmbeddingsView extends Component {
    // constructor(props) {
    //     super(props);
    // }

    render() {
        const {spec, latent, graph} = this.props;
        const {width, height, margins} = spec.latent;
        const svgWidth = width + margins.left + margins.right,
            svgHeight = height + margins.top + margins.bottom;
        const {coords} = latent;
        const {colorScheme, nodes} = graph;

        return (
            <div id="embeddings-view">
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <rect x={-margins.left / 2} y={-margins.top / 2} width={width + (margins.left + margins.right) / 2}
                              height={height + (margins.top + margins.bottom) / 2}
                              style={{stroke: '#ccc', strokeWidth: '1px', fill: 'none'}}/>
                        <g className="points">
                            {coords.map((c, i) =>
                                <circle key={i} className="point" cx={c.x} cy={c.y} r={3} style={{fill: colorScheme[nodes[i].type]}}/>
                            )}
                        </g>
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(EmbeddingsView);
