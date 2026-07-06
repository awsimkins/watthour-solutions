/**
 * WSApp chart bundle — shared HTML chart rendering for test-report and standalone pages.
 */
(function () {
    'use strict';

    var DEFAULT_CHART_WIDTH = 360;
    var DEFAULT_CHART_HEIGHT_LINE = 220;
    var DEFAULT_CHART_HEIGHT_IEEE = 260;
    var DEFAULT_CHART_HEIGHT_VECTOR = 300;

    function chartBlock(svgHtml) {
        return '<div class="report-chart-block">' + (svgHtml || '') + '</div>';
    }

    function noDataChartPlaceholder(msg) {
        return '<div class="report-chart-empty text-xs text-slate-500 p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-center leading-snug">' +
            msg + '</div>';
    }

    function chartCell(title, innerHtml, wide) {
        return '<div class="report-chart-cell' + (wide ? ' report-chart-cell-wide' : '') + '">' +
            '<div class="report-chart-cell-title">' + title + '</div>' +
            innerHtml +
            '</div>';
    }

    function chartGridOpen() {
        return '<div class="report-charts-grid">';
    }

    function chartGridClose() {
        return '</div>';
    }

    function hasBurdenChartPhases(cfg) {
        return !!(cfg && cfg.phases && cfg.phases.length);
    }

    function prepareBurdenReport(report, C, B) {
        if (B && B.prepareCtBurdenReport) {
            B.prepareCtBurdenReport(report);
        } else if (C.prepareReportForCtBurdenCharts) {
            C.prepareReportForCtBurdenCharts(report);
        }
    }

    function chartSize(opts, kind) {
        opts = opts || {};
        var w = opts.chartWidth || DEFAULT_CHART_WIDTH;
        if (kind === 'ieee') return { width: w, height: opts.chartHeightIeee || DEFAULT_CHART_HEIGHT_IEEE };
        if (kind === 'vector') return { width: w, height: opts.chartHeightVector || DEFAULT_CHART_HEIGHT_VECTOR };
        return { width: w, height: opts.chartHeightLine || DEFAULT_CHART_HEIGHT_LINE };
    }

    function buildCtBurdenChartVisuals(report, C, B, opts) {
        opts = opts || {};
        var idPrefix = opts.idPrefix || 'chart-bundle-ct';
        var wrapGrid = opts.wrapGrid !== false;
        prepareBurdenReport(report, C, B);

        var ctAcc = C.buildCtBurdenChartData(report, 'accuracy');
        var ctDrop = C.buildCtBurdenChartData(report, 'drop');
        var ctTrap = C.buildCtParallelogramChartData(report);
        var ctIeee = C.buildCtIeeeParallelogramChartData(report);
        var lineSize = chartSize(opts, 'line');
        var ieeeSize = chartSize(opts, 'ieee');
        var cells = [];

        cells.push(chartCell(
            'CT accuracy vs burden',
            hasBurdenChartPhases(ctAcc)
                ? chartBlock(C.renderBurdenLineChartSvg(ctAcc, {
                    svgId: idPrefix + '-ct-acc-svg',
                    width: lineSize.width,
                    height: lineSize.height
                }))
                : noDataChartPlaceholder('No CT accuracy graph — enter CT burden readings in the field app.')
        ));

        cells.push(chartCell(
            'CT percent drop vs burden',
            hasBurdenChartPhases(ctDrop)
                ? chartBlock(C.renderBurdenLineChartSvg(ctDrop, {
                    svgId: idPrefix + '-ct-drop-svg',
                    width: lineSize.width,
                    height: lineSize.height
                }))
                : noDataChartPlaceholder('No CT drop graph — enter CT burden readings in the field app.')
        ));

        cells.push(chartCell(
            'IEEE C57.13 ratio–phase parallelogram',
            chartBlock(C.renderCtIeeeParallelogramChartSvg(ctIeee, {
                svgId: idPrefix + '-ct-ieee-para-svg',
                width: ieeeSize.width,
                height: ieeeSize.height
            }))
        ));

        cells.push(chartCell(
            'CT burden ratio trapezoid',
            hasBurdenChartPhases(ctTrap)
                ? chartBlock(C.renderCtParallelogramChartSvg(ctTrap, {
                    svgId: idPrefix + '-ct-trap-svg',
                    width: lineSize.width,
                    height: ieeeSize.height
                }))
                : noDataChartPlaceholder(ctTrap.emptyMessage || 'No CT trapezoid — enter accuracy class, burden rating, and CT burden readings.')
        ));

        return wrapGrid ? chartGridOpen() + cells.join('') + chartGridClose() : cells.join('');
    }

    function buildPtBurdenChartVisuals(report, C, B, opts) {
        opts = opts || {};
        var idPrefix = opts.idPrefix || 'chart-bundle-pt';
        var wrapGrid = opts.wrapGrid !== false;
        prepareBurdenReport(report, C, B);

        var ptAcc = C.buildPtBurdenChartData(report, 'accuracy');
        var ptDrop = C.buildPtBurdenChartData(report, 'drop');
        var lineSize = chartSize(opts, 'line');
        var cells = [];

        if (hasBurdenChartPhases(ptAcc)) {
            cells.push(chartCell(
                'PT/VT accuracy vs burden',
                chartBlock(C.renderBurdenLineChartSvg(ptAcc, {
                    svgId: idPrefix + '-pt-acc-svg',
                    width: lineSize.width,
                    height: lineSize.height
                }))
            ));
        }
        if (hasBurdenChartPhases(ptDrop)) {
            cells.push(chartCell(
                'PT/VT percent drop vs burden',
                chartBlock(C.renderBurdenLineChartSvg(ptDrop, {
                    svgId: idPrefix + '-pt-drop-svg',
                    width: lineSize.width,
                    height: lineSize.height
                }))
            ));
        }

        if (!cells.length) {
            return noDataChartPlaceholder('No PT/VT burden graph data — enter PT burden readings in the field app.');
        }
        return wrapGrid ? chartGridOpen() + cells.join('') + chartGridClose() : cells.join('');
    }

    function buildVectorChartVisual(report, C, opts) {
        opts = opts || {};
        var idPrefix = opts.idPrefix || 'chart-bundle-vector';
        if (!C.supportsVectorDiagram || !C.supportsVectorDiagram(report)) {
            return noDataChartPlaceholder('Vector diagram not available for this meter form or phase.');
        }
        var vectorSize = chartSize(opts, 'vector');
        var vectorHtml = (C.renderVectorDiagramSvg || C.renderNineSVectorDiagramSvg)(report, {
            svgId: idPrefix + '-vector-svg',
            width: vectorSize.width,
            height: vectorSize.height
        });
        var cell = chartCell('Vector diagram', chartBlock(vectorHtml));
        if (opts.wrapGrid === false) return cell;
        return chartGridOpen() + cell + chartGridClose();
    }

    function buildBurdenVisuals(report, C, B, opts) {
        opts = opts || {};
        var wrapGrid = opts.wrapGrid !== false;
        var html = buildCtBurdenChartVisuals(report, C, B, { idPrefix: opts.idPrefix || 'chart-bundle', wrapGrid: false });
        html += buildPtBurdenChartVisuals(report, C, B, { idPrefix: (opts.idPrefix || 'chart-bundle') + '-pt', wrapGrid: false });
        return wrapGrid ? chartGridOpen() + html + chartGridClose() : html;
    }

    function buildChartsDocumentHtml(report, C, B, helpers) {
        helpers = helpers || {};
        var normalize = helpers.normalizeReportForDisplay || function (r) { return r; };
        var footer = helpers.buildReportFooter || function () { return ''; };
        var meta = helpers.meta || null;

        report = normalize(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var html = '<div class="report-document-charts" id="report-document-charts">';
        html += '<h2 class="report-section-heading report-section-heading-primary mb-4">Charts / Graphs</h2>';
        html += '<p class="report-lede mb-4">All engineering charts for this test — vector diagram and CT/PT burden graphs.</p>';

        html += chartGridOpen();

        if (C.supportsVectorDiagram && C.supportsVectorDiagram(report)) {
            var vectorSize = chartSize(null, 'vector');
            var vectorHtml = (C.renderVectorDiagramSvg || C.renderNineSVectorDiagramSvg)(report, {
                svgId: 'test-report-charts-vector-svg',
                width: vectorSize.width,
                height: vectorSize.height
            });
            html += chartCell('Vector diagram', chartBlock(vectorHtml), true);
        } else {
            html += chartCell(
                'Vector diagram',
                noDataChartPlaceholder('Vector diagram not available for this meter form or phase.'),
                true
            );
        }

        if (!selfContained) {
            html += buildCtBurdenChartVisuals(report, C, B, { idPrefix: 'test-report', wrapGrid: false });
            html += buildPtBurdenChartVisuals(report, C, B, { idPrefix: 'test-report-pt', wrapGrid: false });
        }

        html += chartGridClose();

        if (selfContained) {
            html += '<p class="text-xs text-slate-500 mt-4">Burden charts apply to instrument-transformer services only.</p>';
        }

        html += footer(meta, report);
        html += '</div>';
        return html;
    }

    window.WSAPP_CHART_BUNDLE = {
        chartBlock: chartBlock,
        noDataChartPlaceholder: noDataChartPlaceholder,
        hasBurdenChartPhases: hasBurdenChartPhases,
        buildBurdenVisuals: buildBurdenVisuals,
        buildCtBurdenChartVisuals: buildCtBurdenChartVisuals,
        buildPtBurdenChartVisuals: buildPtBurdenChartVisuals,
        buildVectorChartVisual: buildVectorChartVisual,
        buildChartsDocumentHtml: buildChartsDocumentHtml
    };
})();