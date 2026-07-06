WSAPP_VISUAL_SHELL.boot({
    title: 'PT % Drop Graph',
    downloadStem: 'pt_drop_graph',
    build: function (report, C) {
        return C.buildPtBurdenChartData(report, 'drop');
    }
});