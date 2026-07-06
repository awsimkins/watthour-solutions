/**
 * Shared boot helpers for standalone WSApp visual pages.
 */
(function () {
    'use strict';

    function boot(opts) {
        var C = window.WSAPP_CALC;
        var B = window.WSAPP_VISUAL_BRIDGE;
        if (!C || !B) {
            document.addEventListener('DOMContentLoaded', function () {
                var host = document.getElementById(opts.hostId || 'visual-chart-host');
                if (host) {
                    host.innerHTML = '<div class="text-xs text-red-600 text-center py-8">Missing WSAPP_CALC or visual bridge scripts.</div>';
                }
            });
            return;
        }

        var state = { report: null, cfg: null };

        function render() {
            state.report = B.loadActiveFieldReport();
            B.populateSiteHeader(state.report);
            B.updateRefreshNote();
            if (!state.report) {
                B.showEmpty(opts.hostId, 'No active field report. Open a site in WSApp, then open this visual from the Charts sidebar.');
                state.cfg = null;
                return;
            }
            state.cfg = opts.build(state.report, C, B);
            var host = document.getElementById(opts.hostId || 'visual-chart-host');
            if (!host) return;
            if (opts.renderHtml) {
                host.innerHTML = typeof state.cfg === 'string' ? state.cfg : '';
            } else if (opts.renderParallelogram) {
                host.innerHTML = C.renderCtParallelogramChartSvg(state.cfg, {
                    svgId: opts.svgId || 'wsapp-visual-svg',
                    width: opts.width || 520,
                    height: opts.height || 360
                });
            } else if (opts.renderVector) {
                host.innerHTML = (C.renderVectorDiagramSvg || C.renderNineSVectorDiagramSvg)(state.report, {
                    svgId: opts.svgId || 'wsapp-visual-svg',
                    width: opts.width || 560,
                    height: opts.height || 400
                });
            } else {
                host.innerHTML = C.renderBurdenLineChartSvg(state.cfg, {
                    svgId: opts.svgId || 'wsapp-visual-svg',
                    width: opts.width || 520,
                    height: opts.height || 360
                });
            }
        }

        function applyEmbedLayout() {
            if (!B.isEmbedMode()) return;
            document.body.classList.add('wsapp-visual-embed');
            var pageHeader = document.querySelector('.wsapp-visual-page-header');
            var footnote = document.querySelector('.wsapp-visual-footnote');
            if (pageHeader) pageHeader.style.display = 'none';
            if (footnote) footnote.style.display = 'none';
        }

        function bind() {
            applyEmbedLayout();
            var back = document.getElementById('btn-back-wsapp');
            var refresh = document.getElementById('btn-refresh');
            var download = document.getElementById('btn-download');
            var share = document.getElementById('btn-share');
            if (back) back.onclick = B.returnToWsapp;
            if (refresh) {
                refresh.onclick = function () {
                    B.requestParentRepublish();
                    render();
                };
            }
            if (download) {
                download.onclick = function () {
                    B.downloadSvgPng(opts.svgId || 'wsapp-visual-svg', opts.downloadStem || 'chart', state.report);
                };
            }
            if (share) {
                share.onclick = function () {
                    B.shareSvgPng(opts.svgId || 'wsapp-visual-svg', opts.title || 'Chart', state.report);
                };
            }
            window.addEventListener('focus', render);
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) render();
            });
        }

        document.addEventListener('DOMContentLoaded', function () {
            bind();
            render();
        });
    }

    window.WSAPP_VISUAL_SHELL = { boot: boot };
})();