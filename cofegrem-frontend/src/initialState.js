export default {
    loaded: false,

    isNodeHighlighted: null,        // Either null or an array of booleans
    highlightTrigger: null,
    showDetailNode: null,

    selectedNodeType: 0,
    selectedNodes: [],
    isNodeSelected: null,           // Make sure the two data structures are in-sync
    neighborIntersections: null,
    neighborCounts: null,

    spec: {
        graph: {
            width: 500,
            height: 500,
            margins: {top: 30, bottom: 30, left: 30, right: 30}
        },
        latent: {
            width: 300,
            height: 300,
            margins: {top: 10, bottom: 10, left: 10, right: 10}
        },
        intersectionPlot: {
            margins: {top: 10, bottom: 10, left: 10, right: 10},
            topLabelHeight: 30,
            dotSize: 10,
            dotMargin: 10,
            verticalMargin: 5,
            cardScaleRange: 50,
            plotHorizontalMargin: 30,
        },
        adjacencyMatrix: {
            margins: {top: 10, bottom: 10, left: 10, right: 80},
            rowHeight: 14,
            colWidth: 14,
            gap: 6,
            labelAreaSize: 100,
            labelSize: 10,   // Must be <= rowHeight and colWidth
            countAreaSize: 20,
        },
        histogram: {
            margins: {top: 30, bottom: 30, left: 30, right: 10, betweenHist: 20},
            height: 100,
            barWidth: 10,
            barGap: 2,
        }
    }
};