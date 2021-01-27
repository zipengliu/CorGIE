export default {
    loaded: false,
    datasetId: null,
    homePath: "",
    // homePath: '/~zipeng/private/cofegrem-prototype',

    isNodeHighlighted: {}, // Either null or an array of booleans
    highlightTrigger: null,
    showDetailNode: null,

    centralNodeType: 0,

    selectedNodeType: 0,
    selectedNodes: [],      // Array of array
    selBoundingBox: [],
    isNodeSelected: {},     // Dict for ALL selected nodes
    isNodeSelectedNeighbor: {},
    neighborIntersections: null,

    focalGraphLayout: {
        running: false,
    },

    powerSetLimit: 8,

    nodeAttrs: null,             // Attribute distributions for all nodes
    selNodeAttrs: [],           // Attribute distributions for selected nodes, each selection group is an array in selNodeAttrs
    nodesToHighlight: [],
    edgesToHighlight: [],

    edgeAttributes: {
        type: {
            type: "categorical",
            values: ["train", "valid", "test"],
            show: [true, true, true],
            counts: [0, 0, 0],
        },
    },
    showEdges: [],
    selectedEdge: null,

    param: {
        hops: 2,
        hopsHighlight: 1,

        colorBy: 'position',        // Could be "position" or index of nodeAttrs
        colorScale: null,

        // neighborDistanceMetric: 'hamming',
        neighborDistanceMetric: "jaccard",

        graph: {
            layout: "force-directed-d3",
            // layout: "random",
        },

        focalGraph: {
            // layout: 'force-directed-d3',
            layout: "umap",
            // layout: 'spiral',
            // layout: 'group-constraint-cola',
        },

        filter: {
            ascending: true,
            edgeDistRange: [0.5, 0.6],
        },
    },

    spec: {
        graph: {
            edgeType: "line",
            width: 1000,
            height: 1000,
            margins: { top: 10, bottom: 10, left: 20, right: 20 },

            neighborMarkerMaxHeight: 30,
            centralNodeSize: 4,
            auxNodeSize: 3,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50, // Minimum gap between the two rings (along the radius axis)
        },
        focalGraph: {
            width: 300,
            height: 300,
        },
        latent: {
            width: 400,
            height: 400,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            histSize: { width: 200, height: 100 },
            histMargins: { top: 10, bottom: 30, left: 30, right: 10 },
        },
        intersectionPlot: {
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            topLabelHeight: 30,
            dotSize: 10,
            dotMargin: 10,
            verticalMargin: 5,
            cardScaleRange: 50,
            plotHorizontalMargin: 30,
        },
        adjacencyMatrix: {
            margins: { top: 10, bottom: 10, left: 10, right: 80 },
            rowHeight: 14,
            colWidth: 14,
            gap: 6,
            histogramAreaHeight: 120,
            histogramHeight: 100,
            labelHeight: 10,

            labelAreaSize: 100,
            labelSize: 10, // Must be <= rowHeight and colWidth
            countAreaSize: 20,
            countBarHeight: 100,
        },
        histogram: {
            margins: { top: 10, bottom: 30, left: 30, right: 10, betweenHist: 20 },
            height: 60,
            width: 100,
            barWidth: 10,
            barGap: 2,
        },
        scatterplot: {
            margins: { top: 20, bottom: 30, left: 30, right: 10 },
            height: 200,
            width: 200,
            dotSize: 2,
        },
        feature: {
            cellSize: 6,
            cellGap: 1,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            barcodeMaxWidth: 250,
            barcodeHeight: 15,
        }
    },
};
