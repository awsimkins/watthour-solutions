WSAPP_VISUAL_SHELL.boot({
    title: 'PT Accuracy Graph',
    downloadStem: 'pt_accuracy_graph',
    build: function (report, C) {
        return C.buildPtBurdenChartData(report, 'accuracy');
    }
});