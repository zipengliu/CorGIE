export default {
    loaded: false,
    datasetId: null,
    homePath: "",
    // homePath: '/~zipeng/private/cofegrem-prototype',

    centralNodeType: 0,
    nodeColors: [],

    selectedNodeType: 0,
    selectedNodes: [], // Array of array
    selBoundingBox: [],
    isNodeSelected: {}, // Dict for ALL selected nodes
    selNodeAttrs: [], // Attribute distributions for selected nodes, each selection group is an array in selNodeAttrs
    selFeatures: [], // Binary feature distribution for each selected group
    focalDistances: [],
    isNodeSelectedNeighbor: {},

    highlightedNodes: [],
    highlightedNodePairs: [],
    highlightedEdges: [], // list of edges between highlighted nodes

    hoveredNodes: [], // either one or two nodes (when hovering on an edge)
    hoveredNeighbors: [], // neighbors of hovered nodes + hovered nodes
    hoveredEdges: [], // list of edges between hovered nodes and their neighbors

    neighborIntersections: null,

    initialLayout: {
        running: true,
    },
    focalLayout: {
        running: false,
    },

    nodeAttrs: null, // Attribute distributions for all nodes
    edgeAttributes: {
        type: {
            type: "categorical",
            values: ["train", "valid", "test"],
            show: [true, true, true],
            counts: [0, 0, 0],
        },
    },
    // showEdges: [],
    // selectedEdge: null,

    param: {
        hops: 2,
        hopsHighlight: 1,

        colorBy: -1, // Could be -1 (for emb 2d postion) or a name of the attribute
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

        features: {
            collapsedAll: false,
            collapsedSel: [],
        },

        // Highlight nodes with the following filter in the node attributes
        // Either use node attributes or search by labels, one or the other, not the same time.
        nodeFilter: {
            whichAttr: null,
            brushedArea: null,
            searchLabel: null,
            searchId: null,
        },

        nodePairFilter: {
            ascending: true, // sort the node pairs by latent distance in ascending order
            which: null, // could be null, all, edge, 0 (for foc-0), 1 (for foc-1), 2 (for b/w)
            brushedRange: null,
        },

        topoVsLatent: {
            topoDistFunc: null, // We are going to have different metrics to measure topo difference
            shownNodePairs: "edge", // Could be all, edge, highlighted, and by types (e.g movie-movie, movie-user)
        },
    },

    spec: {
        coordRescaleMargin: 6, // must be smaller than node radius
        graph: {
            edgeType: "line",
            margin: 15,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },

            neighborMarkerMaxHeight: 30,
            nodeSize: 4,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50, // Minimum gap between the two rings (along the radius axis)
        },
        latent: {
            width: 400,
            height: 400,
            nodeSize: 3,
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
            margins: { top: 5, bottom: 5, left: 10, right: 10 },
            barcodeMaxWidth: 1000,
            barcodeHeight: 15,
        },
    },
};
