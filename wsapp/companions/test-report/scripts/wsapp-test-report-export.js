/**
 * WSApp Test Report — print, share, PDF/HTML export.
 */
(function () {
    'use strict';

    window.WSAPP_TR_EXPORT = {
        attach: function (api) {
            Object.keys(exportApi).forEach(function (k) { api[k] = exportApi[k]; });
        }
    };

    var exportApi = {};

    function attachExportHelpers(ctx) {
        exportApi.printDocument = function (target) { return printDocument(ctx, target); };
        exportApi.printSection = function (sectionId) {
            if (ctx.printSection) return ctx.printSection(sectionId);
        };
        exportApi.shareDocument = function (target) { return shareDocument(ctx, target); };
        exportApi.downloadDocument = function (target) { return downloadDocument(ctx, target); };
        exportApi.printReport = function () { return printDocument(ctx, ctx.getActiveDocumentTarget()); };
        exportApi.shareReport = function () { return shareDocument(ctx, ctx.getActiveDocumentTarget()); };
        exportApi.downloadHtmlSnapshot = function () { return downloadDocument(ctx, ctx.getActiveDocumentTarget()); };
    }

    window.WSAPP_TR_EXPORT.attachHelpers = attachExportHelpers;

    function html2pdfAvailable() {
        return typeof window.html2pdf === 'function';
    }

    function getPrintableRootElement(ctx, target) {
        if (target === 'summary') return document.getElementById('section-summary');
        if (target === 'full') return document.getElementById('report-document-full');
        if (target === 'charts') return document.getElementById('report-document-charts');
        return document.getElementById('test-report-host');
    }

    function setPrintTargetClass(target) {
        document.body.classList.remove(
            'print-target-summary', 'print-target-full', 'print-target-charts', 'print-target-both', 'print-target-section'
        );
        if (target && String(target).indexOf('section:') === 0) {
            document.body.classList.add('print-target-section');
            return;
        }
        document.body.classList.add('print-target-' + (target || 'both'));
    }

    function clearPrintTargetClass() {
        document.body.classList.remove(
            'print-target-summary', 'print-target-full', 'print-target-charts', 'print-target-both', 'print-target-section'
        );
        document.querySelectorAll('.print-focus').forEach(function (el) { el.classList.remove('print-focus'); });
    }

    function printDocument(ctx, target) {
        if (!getPrintableRootElement(ctx, target)) {
            ctx.showReportToast('Nothing to print.', 'error');
            return;
        }
        setPrintTargetClass(target);
        window.print();
        setTimeout(clearPrintTargetClass, 500);
    }

    function downloadDocument(ctx, target) {
        if (!getPrintableRootElement(ctx, target)) {
            ctx.showReportToast('Nothing to download.', 'error');
            return;
        }
        ctx.downloadDocumentHtml(target);
    }

    function shareDocument(ctx, target) {
        if (!getPrintableRootElement(ctx, target)) {
            ctx.showReportToast('Nothing to share.', 'error');
            return;
        }
        if (target === 'summary' || target === 'full' || target === 'charts' || target === 'both') {
            ctx.shareDocumentHtml(target).catch(function (err) {
                if (err && err.name === 'AbortError') return;
                ctx.shareDocumentText(target);
            });
            return;
        }
        ctx.shareDocumentText(target);
    }

    window.WSAPP_TR_EXPORT.attach = function (api) {
        attachExportHelpers(api);
    };
})();