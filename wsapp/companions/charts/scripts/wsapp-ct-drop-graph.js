WSAPP_VISUAL_SHELL.boot({
    title: 'CT % Drop Graph',
    downloadStem: 'ct_drop_graph',
    build: function (report, C, B) {
        B.prepareCtBurdenReport(report);
        return C.buildCtBurdenChartData(report, 'drop');
    }
});