export default {
    loaded: false,

    isNodeHighlighted: null,        // Either null or an array of booleans
    highlightTrigger: null,
    showDetailNode: null,

    selectedNodes: [],
    isNodeSelected: null,           // Make sure the two data structures are in-sync
    neighborIntersections: null,

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
            plotHorizontalMargin: 10,
        }
    }
};