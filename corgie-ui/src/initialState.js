import { bin as d3bin } from "d3";

export default {
    loaded: false,
    datasetId: null,
    homePath: "",
    // homePath: '/~zipeng/private/cofegrem-prototype',

    centralNodeType: 0,
    nodeColors: [],

    featureAgg: {
        cnts: null
    },

    selectedNodes: [], // Array of array
    selBoundingBox: [],
    isNodeSelected: {}, // Dict for ALL selected nodes
    selNodeAttrs: [], // Attribute distributions for selected nodes, each selection group is an array in selNodeAttrs
    selFeatures: [], // Binary feature distribution for each selected group
    isNodeSelectedNeighbor: {},

    highlightedNodes: [],
    highlightedNodePairs: [],
    highlightedEdges: [], // list of edges between highlighted nodes

    hoveredNodes: [], // either one or two nodes (when hovering on an edge)
    hoveredNeighbors: [], // neighbors of hovered nodes + hovered nodes
    hoveredEdges: [], // list of edges between hovered nodes and their neighbors

    neighborIntersections: null,

    distances: {
        maxSample: 1000000,
        display: [{isComputing: true, title: 'all (down-sampled)'}, {isComputing: true, title: 'those connected by edges'}],
    },

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
        hopsHover: 1,

        colorBy: -1, // Could be -1 (for emb 2d postion) or a name of the attribute
        colorScale: null,

        // neighborDistanceMetric: 'hamming',
        neighborDistanceMetric: "jaccard",

        nodeSize: 4,
        embNodeSize: 3,

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

        latent: {
            selectedNodeType: 0,
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
            // ascending: true, // sort the node pairs by latent distance in ascending order
            which: null, 
            brushedArea: null,
            useLinearScale: true,
        },

        topoVsLatent: {
            topoDistFunc: null, // We are going to have different metrics to measure topo difference
            shownNodePairs: "edge", // Could be all, edge, highlighted, and by types (e.g movie-movie, movie-user)
        },
    },

    spec: {
        coordRescaleMargin: 6, // must be smaller than node radius
        graph: {
            margin: 5,
            padding: 12,    // padding of group
            gapBetweenHop: 10,

            edgeType: "line",
            neighborMarkerMaxHeight: 30,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50, // Minimum gap between the two rings (along the radius axis)
        },
        latent: {
            width: 400,
            height: 400,
            nodeSize: 3,
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
            margins: { top: 10, bottom: 30, left: 30, right: 10 },
            height: 60,
            width: 100,
        },
        partialHistogram: {
            margins: { top: 10, bottom: 30, left: 30, right: 10 },
            height: 30,
            width: 100,
        },
        scatterHist: {
            margins: { top: 15, bottom: 12, left: 18, right: 20 },
            histHeight: 30,
            scatterHeight: 100,
            histWidth: 30,
            scatterWidth: 100,
            tickLabelGap: 15,
            dotSize: 2,
            numBins: 20,
            legendWidth: 20,
            gridBinSize: 0.05,
        },
        feature: {
            cellSize: 6,
            cellGap: 1,
            margins: { top: 5, bottom: 5, left: 10, right: 10 },
            barcodeMaxWidth: 1000,
            barWidth: 2,
            maxNumBars: 500,    // remember to sync these three values
            barcodeHeight: 15,
        },
    },
};
