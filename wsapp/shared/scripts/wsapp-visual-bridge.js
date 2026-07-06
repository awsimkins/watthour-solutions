/**
 * WSApp Visual Bridge — shared data + export helpers for standalone chart/diagram pages.
 * Reads wsapp_active_field_report from localStorage (published by index.html).
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'wsapp_active_field_report';

    function loadPayload() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function loadActiveFieldReport() {
        var payload = loadPayload();
        return payload && payload.data ? payload.data : null;
    }

    function getSavedMeta() {
        var payload = loadPayload();
        if (!payload) return null;
        return {
            saved_at: payload.saved_at || '',
            report_id: payload.report_id || ''
        };
    }

    function formatSavedAt(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    }

    function populateSiteHeader(report, ids) {
        ids = ids || {};
        var data = report || {};
        var locateEl = document.getElementById(ids.locate || 'visual-locate');
        var memberEl = document.getElementById(ids.member || 'visual-member');
        var meterEl = document.getElementById(ids.meter || 'visual-meter');
        if (locateEl) locateEl.textContent = data.location_number || '—';
        if (memberEl) memberEl.textContent = data.customer_name || '—';
        if (meterEl) meterEl.textContent = data.meter_number || '—';
    }

    function updateRefreshNote(noteId) {
        var el = document.getElementById(noteId || 'visual-refresh-note');
        if (!el) return;
        var meta = getSavedMeta();
        var when = formatSavedAt(meta && meta.saved_at);
        el.textContent = when
            ? 'Data from WSApp · last published ' + when + '. Tap Refresh after editing the report.'
            : 'Data from WSApp. Tap Refresh after editing the report.';
    }

    function showEmpty(hostId, message) {
        var host = document.getElementById(hostId || 'visual-chart-host');
        if (!host) return;
        host.innerHTML = '<div class="text-xs text-slate-500 text-center py-8 px-4 leading-relaxed">' + message + '</div>';
    }

    function prepareCtBurdenReport(report) {
        var C = window.WSAPP_CALC;
        if (!report || !C) return report;
        if (C.prepareReportForCtBurdenCharts) C.prepareReportForCtBurdenCharts(report);
        return report;
    }

    function svgElementToPngBlob(svg, defaultW, defaultH) {
        if (!svg) return Promise.reject(new Error('No diagram'));
        var serializer = new XMLSerializer();
        var svgStr = serializer.serializeToString(svg);
        if (svgStr.indexOf('xmlns=') === -1) {
            svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        var svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        var url = URL.createObjectURL(svgBlob);
        var img = new Image();
        var vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
        var w = (vb && vb.width) ? vb.width : (defaultW || 560);
        var h = (vb && vb.height) ? vb.height : (defaultH || 400);
        return new Promise(function (resolve, reject) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var scale = 2;
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) {
                    if (blob) resolve(blob);
                    else reject(new Error('PNG encode failed'));
                }, 'image/png');
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('SVG render failed'));
            };
            img.src = url;
        });
    }

    function downloadSvgPng(svgId, filenameStem, report) {
        var svg = document.getElementById(svgId);
        svgElementToPngBlob(svg).then(function (blob) {
            var loc = String((report && report.location_number) || 'site').replace(/[^\w\-]+/g, '_');
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filenameStem + '_' + loc + '.png';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }).catch(function () {
            alert('Could not download image.');
        });
    }

    function shareSvgPng(svgId, title, report) {
        svgElementToPngBlob(document.getElementById(svgId)).then(function (blob) {
            var file = new File([blob], (title || 'chart').replace(/\s+/g, '_').toLowerCase() + '.png', { type: 'image/png' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                return navigator.share({ files: [file], title: title || 'Chart' });
            }
            if (navigator.share) {
                return navigator.share({
                    title: title || 'Chart',
                    text: 'WSApp — ' + ((report && report.location_number) || 'site')
                });
            }
            downloadSvgPng(svgId, (title || 'chart').replace(/\s+/g, '_').toLowerCase(), report);
            alert('Share not available — image downloaded instead.');
        }).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            alert('Could not share image.');
        });
    }

    function isEmbedMode() {
        try {
            if (window.self !== window.top) return true;
        } catch (e) {
            return true;
        }
        return /(?:^|[?&])embed=1(?:&|$)/.test(window.location.search || '');
    }

    function postToParent(type, extra) {
        try {
            if (window.parent && window.parent !== window) {
                var payload = { type: type };
                if (extra && typeof extra === 'object') {
                    Object.keys(extra).forEach(function (k) { payload[k] = extra[k]; });
                }
                window.parent.postMessage(payload, '*');
                return true;
            }
        } catch (e) { /* file:// cross-origin */ }
        return false;
    }

    function returnToWsapp() {
        if (isEmbedMode()) {
            try {
                if (window.parent && window.parent.closeVisualViewerModal) {
                    window.parent.closeVisualViewerModal();
                    return;
                }
            } catch (e) { /* cross-origin guard */ }
            if (postToParent('wsapp-visual-close')) return;
        }
        var appUrl = (window.WSAPP_PATHS && window.WSAPP_PATHS.appIndex)
            ? window.WSAPP_PATHS.appIndex()
            : '../../app/index.html';
        window.location.href = appUrl;
    }

    function requestParentRepublish() {
        if (!isEmbedMode()) return;
        try {
            if (window.parent && window.parent.WSAPP_REPUBLISH_VISUAL) {
                window.parent.WSAPP_REPUBLISH_VISUAL();
                return;
            }
        } catch (e) { /* ignore */ }
        postToParent('wsapp-visual-republish-request');
    }

    window.WSAPP_VISUAL_BRIDGE = {
        STORAGE_KEY: STORAGE_KEY,
        loadPayload: loadPayload,
        loadActiveFieldReport: loadActiveFieldReport,
        getSavedMeta: getSavedMeta,
        formatSavedAt: formatSavedAt,
        populateSiteHeader: populateSiteHeader,
        updateRefreshNote: updateRefreshNote,
        showEmpty: showEmpty,
        prepareCtBurdenReport: prepareCtBurdenReport,
        svgElementToPngBlob: svgElementToPngBlob,
        downloadSvgPng: downloadSvgPng,
        shareSvgPng: shareSvgPng,
        isEmbedMode: isEmbedMode,
        returnToWsapp: returnToWsapp,
        requestParentRepublish: requestParentRepublish
    };
})();