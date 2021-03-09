import { bin as d3bin } from "d3";

export default {
    loaded: false,
    datasetId: null,
    homePath: "",
    // homePath: '/~zipeng/private/cofegrem-prototype',

    numNodeClasses: false,
    hasLinkPrections: false,

    centralNodeType: 0,
    nodeColors: [],

    featureAgg: {
        active: false,
        hovered: null,
        highlighted: null,
        display: [],
    },
    nodeAttrs: {
        active: false,
        hovered: null,
        highlighted: null,
        display: [],
    },

    selectedNodes: [], // Array of array
    selBoundingBox: [],
    isNodeSelected: {}, // Dict for ALL selected nodes
    isNodeSelectedNeighbor: {},

    highlightedNodes: [],
    highlightedNodePairs: [],
    highlightedEdges: [], // list of edges between highlighted nodes

    hoveredNodes: [], // either one or two nodes (when hovering on an edge)
    hoveredNodesAndNeighbors: [], // neighbors of hovered nodes + hovered nodes
    hoveredEdges: [], // list of edges between hovered nodes and their neighbors

    neighborIntersections: null,

    distances: {
        maxSample: 1000000,
        display: [
            { isComputing: true, title: "all (down-sampled)" },
            { isComputing: true, title: "connected by edges" },
        ],
    },

    initialLayout: {
        running: true,
    },
    focalLayout: {
        running: false,
    },

    // edgeAttributes: {
    //     type: {
    //         type: "categorical",
    //         values: ["train", "valid", "test"],
    //         show: [true, true, true],
    //         counts: [0, 0, 0],
    //     },
    // },
    // showEdges: [],
    // selectedEdge: null,

    param: {
        hops: 2,
        hopsActivated: 1,
        onlyActivateOne: false, // whether to activate one node or one node + its neighbors

        colorBy: "umap", // Could be "umap" (for emb 2d postion), "pred-labels", "true-labels", "correctness", or a name of the attribute
        colorScale: null,

        // neighborDistanceMetric: 'hamming',
        neighborDistanceMetric: "jaccard",

        nodeSize: 4,
        embNodeSize: 3,

        // Only highlight nodes of type / label
        highlightNodeType: "all", // "all" or integer for a specific node type
        highlightNodeLabel: "all", // "all", "correct", "wrong", "pred-${k}", "true-${k}" where k is the label ID

        graph: {
            layout: "force-directed-d3",
            // layout: "random",
            bounded: false,
        },

        focalGraph: {
            // layout: 'force-directed-d3',
            layout: "umap",
            // layout: 'spiral',
            // layout: 'group-constraint-cola',
            useEdgeBundling: true,
        },

        features: {
            collapsed: [false],
        },

        // Highlight nodes with the following filter in the node attributes
        // Either use node attributes or search by labels, one or the other, not the same time.
        nodeFilter: {
            whichAttr: null,
            whichRow: null,
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
        graph: {
            margin: 5,
            padding: 16, // padding of group
            gapBetweenHop: 8,

            edgeType: "line",
            neighborMarkerMaxHeight: 30,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50, // Minimum gap between the two rings (along the radius axis)
        },
        latent: {
            width: 400,
            height: 400,
            paddings: { top: 16, bottom: 4, left: 6, right: 6 },
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
            margins: { top: 10, bottom: 18, left: 30, right: 10 },
            height: 60,
            width: 100,
        },
        partialHistogram: {
            margins: { top: 10, bottom: 18, left: 30, right: 10 },
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
            margins: { top: 8, bottom: 8, left: 10, right: 10 },
            stripMaxWidth: 1000,
            stripWidth: 2,
            maxNumStrips: 500, // remember to sync these three values
            stripHeight: 15,
        },
    },
};
