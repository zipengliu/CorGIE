import React, {Component} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import cn from 'classnames';
import {scaleLinear} from 'd3';
import './SemanticSpaceView.css';


class SemanticSpaceView extends Component {
    render() {
        const {graph, neighborIntersections, selectedNodes, selectedCountsByType} = this.props;
        if (neighborIntersections === null) return <div />;
        const {nodes, nodeTypes} = graph;

        // Compute height and width of SVG
        const spec = this.props.spec.intersectionPlot;
        const {margins, dotSize, dotMargin, verticalMargin, cardScaleRange, plotHorizontalMargin, topLabelHeight} = spec;
        const n = selectedNodes.length, numberOfTypes = neighborIntersections.length;
        const dotsWidth = n * (dotSize + dotMargin);
        const svgWidth = margins.left + margins.right + dotsWidth + numberOfTypes * (cardScaleRange + plotHorizontalMargin),
            svgHeight = margins.top + margins.bottom + topLabelHeight + neighborIntersections[0].length * (verticalMargin + dotSize);

        // Compute the scale for bar charts
        // TODO: consider using another max value for the domain since the overlap of neighbors might be small and the bars are really tiny
        const scalesByType = selectedCountsByType.map(c => scaleLinear().domain([0, c+1]).range([0, cardScaleRange]));

        return (
            <div id='semantic-space-view'>
                <svg width={svgWidth} height={svgHeight}>
                    <g transform={`translate(${margins.left},${margins.top})`}>
                        <g className="combinations">
                            <g className="labels">
                            </g>
                            <g transform={`translate(${dotMargin / 2},${topLabelHeight})`}>
                                {neighborIntersections[0].map((row, i) =>
                                    <g key={i} transform={`translate(${dotSize / 2},${i * (dotSize + verticalMargin) + dotSize / 2})`}>
                                        {selectedNodes.map((_, j) =>
                                            <circle key={j} className={cn('dot', {selected: row.combo.get(j)})}
                                                    cx={j * (dotSize + dotMargin)} cy={0} r={dotSize / 2} />
                                        )}
                                    </g>
                                )}
                            </g>
                        </g>

                        <g className="bar-charts" transform={`translate(${dotsWidth},0)`}>
                            <g className="labels">
                            </g>
                            <g transform={`translate(0,${topLabelHeight})`}>
                                {neighborIntersections.map((plotData, i) =>
                                    <g key={i} transform={`translate(${i * (cardScaleRange + plotHorizontalMargin)},0)`}>
                                        {plotData.map((row, j) =>
                                            <rect key={j} className="bar" x={0} y={j * (dotSize + verticalMargin)}
                                                  height={dotSize} width={scalesByType[i](row.size)}
                                                  style={{fill: nodeTypes[i].color}} />
                                        )}
                                    </g>
                                )}
                            </g>
                        </g>
                    </g>
                </svg>
            </div>
        );
    }
}

const mapStateToProps = state => ({...state});

const mapDispatchToProps = dispatch => bindActionCreators({}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(SemanticSpaceView);
