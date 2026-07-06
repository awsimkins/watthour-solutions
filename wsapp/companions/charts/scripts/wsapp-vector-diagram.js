WSAPP_VISUAL_SHELL.boot({
    title: 'Vector Diagram',
    downloadStem: 'vector_diagram',
    svgId: 'wsapp-visual-svg',
    width: 560,
    height: 400,
    renderVector: true,
    build: function (report, C) {
        return report;
    }
});