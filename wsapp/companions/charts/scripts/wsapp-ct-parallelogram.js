WSAPP_VISUAL_SHELL.boot({
    title: 'CT Parallelogram',
    downloadStem: 'ct_parallelogram',
    renderHtml: true,
    svgId: 'wsapp-ieee-para-svg',
    build: function (report, C, B) {
        B.prepareCtBurdenReport(report);
        return C.renderCtParallelogramChartsHtml(report, {
            ieeeSvgId: 'wsapp-ieee-para-svg',
            burdenSvgId: 'wsapp-burden-trapezoid-svg',
            width: 520,
            height: 260,
            ieeeHeight: 340
        });
    }
});