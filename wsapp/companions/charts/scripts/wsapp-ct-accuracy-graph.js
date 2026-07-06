WSAPP_VISUAL_SHELL.boot({
    title: 'CT Accuracy Graph',
    downloadStem: 'ct_accuracy_graph',
    build: function (report, C, B) {
        B.prepareCtBurdenReport(report);
        return C.buildCtBurdenChartData(report, 'accuracy');
    }
});