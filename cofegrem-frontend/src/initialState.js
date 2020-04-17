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
    selectedNodes: [],
    isNodeSelected: {}, // Make sure the two data structures are in-sync
    isNodeSelectedNeighbor: {},
    neighborIntersections: null,
    neighborCounts: [],
    neighborCountsMapping: {},

    powerSetLimit: 8,

    param: {
        hops: 2,

        graph: {
            layout: "force-directed-d3",
        },

        filter: {
            presentEdges: true,
            absentEdges: true,
            ascending: true
        }
    },

    spec: {
        graph: {
            edgeType: "line",
            width: 1000,
            height: 1000,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },

            neighborMarkerMaxHeight: 30,
            centralNodeSize: 4,
            auxNodeSize: 3,
            innerRingNodeGap: 10,
            outerRingNodeGap: 2,
            minRingGap: 50 // Minimum gap between the two rings (along the radius axis)
        },
        focalGraph: {
            width: 300,
            height: 300,
        },
        latent: {
            width: 400,
            height: 400,
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            histSize: { width: 200, height: 100 }
        },
        intersectionPlot: {
            margins: { top: 10, bottom: 10, left: 10, right: 10 },
            topLabelHeight: 30,
            dotSize: 10,
            dotMargin: 10,
            verticalMargin: 5,
            cardScaleRange: 50,
            plotHorizontalMargin: 30
        },
        adjacencyMatrix: {
            margins: { top: 10, bottom: 10, left: 10, right: 80 },
            rowHeight: 14,
            colWidth: 14,
            gap: 6,
            labelAreaSize: 100,
            labelSize: 10, // Must be <= rowHeight and colWidth
            countAreaSize: 20,
            countBarHeight: 100
        },
        histogram: {
            margins: { top: 10, bottom: 30, left: 30, right: 10, betweenHist: 20 },
            height: 100,
            barWidth: 10,
            barGap: 2
        }
    }
};
