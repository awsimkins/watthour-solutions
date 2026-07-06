/**
 * WSApp client-facing Field Test Report — summary, burden tables/graphs, vector diagram.
 * Standalone page + iframe embed; parent modal calls window.WSAPP_TEST_REPORT actions.
 */
(function () {
    'use strict';

    var REPORT_PAGE_VERSION = '1.6.0';

    /** Meter accuracy bands for client-facing pills (ANSI C12.1 field-test style ±0.5% / ±0.2%). */
    var METER_TEST_TIER_BANDS = {
        badOuter: 0.5,
        warnOuter: 0.2,
        reference: 'ANSI C12.1 Class 1.0 field-test bands (±0.5% action, ±0.2% review)'
    };

    var WATTHOUR_BUSINESS = {
        name: 'Watthour Solutions',
        address: 'PO Box 47',
        city: 'Mount Vernon',
        state: 'MO',
        zip: '65712',
        logo: 'assets/logo.png'
    };

    var state = { report: null, utility: 'GENERAL', meta: null, view: 'all' };
    var toastTimer = null;

    /** URL view: summary | full | charts | all (standalone default — summary + full) */
    function getReportView() {
        try {
            var m = /(?:^|[?&])view=(summary|full|charts)(?:&|$)/i.exec(window.location.search || '');
            if (m) return m[1].toLowerCase();
        } catch (e) { /* ignore */ }
        return 'all';
    }

    var USAGE_FIELD_LABELS = {
        secondary_volts_an: 'Meter voltage — Phase A to neutral',
        secondary_volts_bn: 'Meter voltage — Phase B to neutral',
        secondary_volts_cn: 'Meter voltage — Phase C to neutral',
        secondary_volts_ab: 'Meter voltage — A to B',
        secondary_volts_bc: 'Meter voltage — B to C',
        secondary_volts_ca: 'Meter voltage — C to A',
        primary_volts_an: 'Line voltage (primary) — A to neutral',
        primary_volts_bn: 'Line voltage (primary) — B to neutral',
        primary_volts_cn: 'Line voltage (primary) — C to neutral',
        primary_volts_ab: 'Line voltage (primary) — A to B',
        primary_volts_bc: 'Line voltage (primary) — B to C',
        primary_volts_ca: 'Line voltage (primary) — C to A',
        voltage_thd_an: 'Voltage distortion (THD) — A-N',
        voltage_thd_bn: 'Voltage distortion (THD) — B-N',
        voltage_thd_cn: 'Voltage distortion (THD) — C-N',
        voltage_thd_ab: 'Voltage distortion (THD) — A-B',
        voltage_thd_bc: 'Voltage distortion (THD) — B-C',
        voltage_thd_ca: 'Voltage distortion (THD) — C-A',
        primary_amps_a: 'Line current — Phase A',
        primary_amps_b: 'Line current — Phase B',
        primary_amps_c: 'Line current — Phase C',
        secondary_amps_a: 'Meter current — Phase A',
        secondary_amps_b: 'Meter current — Phase B',
        secondary_amps_c: 'Meter current — Phase C',
        current_thd_a: 'Current distortion (THD) — Phase A',
        current_thd_b: 'Current distortion (THD) — Phase B',
        current_thd_c: 'Current distortion (THD) — Phase C',
        phase_angle_a_an: 'Phase angle — A vs A-N',
        phase_angle_a_bn: 'Phase angle — A vs B-N',
        phase_angle_a_cn: 'Phase angle — A vs C-N',
        phase_angle_a_ab: 'Phase angle — A vs A-B',
        phase_angle_a_bc: 'Phase angle — A vs B-C',
        phase_angle_a_ca: 'Phase angle — A vs C-A',
        phase_angle_b_bn: 'Phase angle — B vs B-N',
        phase_angle_b_cn: 'Phase angle — B vs C-N',
        phase_angle_b_an: 'Phase angle — B vs A-N',
        phase_angle_b_bc: 'Phase angle — B vs B-C',
        phase_angle_b_ca: 'Phase angle — B vs C-A',
        phase_angle_b_ab: 'Phase angle — B vs A-B',
        phase_angle_c_cn: 'Phase angle — C vs C-N',
        phase_angle_c_an: 'Phase angle — C vs A-N',
        phase_angle_c_bn: 'Phase angle — C vs B-N',
        phase_angle_c_ca: 'Phase angle — C vs C-A',
        phase_angle_c_ab: 'Phase angle — C vs A-B',
        phase_angle_c_bc: 'Phase angle — C vs B-C'
    };

    var METER_TEST_FIELDS = [
        { key: 'as_found_full_load', label: 'As Found Full Load' },
        { key: 'as_found_light_load', label: 'As Found Light Load' },
        { key: 'as_found_pf_test', label: 'As Found PF Test' },
        { key: 'as_found_weighted_average', label: 'Overall Weighted' }
    ];

    var REGISTER_READING_FIELDS = [
        { key: 'kwh', label: 'KWh' },
        { key: 'kw', label: 'KW' },
        { key: 'kva', label: 'KVA' },
        { key: 'kvarh', label: 'KVARh' }
    ];

    var METER_NOTE_MATCHERS = [
        'Unable to view readings on meter',
        'Meter is broken',
        'Meter is out of calibration',
        'Unable to test meter in field',
        'Meter wont test',
        'Other Test Problem'
    ];

    var SOCKET_NOTE_MATCHERS = [
        'Socket is damaged',
        'Surge Protector',
        'Meter hub is broken',
        'Socket does not contain bypass',
        'ring was not sealed',
        'socket was not sealed',
        'Socket is not grounded',
        'Unable to check socket ground',
        'Ground has been stolen',
        'Ground is broken',
        'Socket ground impedance',
        'Socket ground amps',
        'Ground resistance is overlimit',
        'Socket ground is overlimit'
    ];

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function str(v) {
        return String(v == null ? '' : v).trim();
    }

    function val(v) {
        return str(v) ? escapeHtml(v) : '<span class="report-empty">—</span>';
    }

    function notifyParentToast(message, kind) {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'wsapp-test-report-toast',
                    message: message,
                    kind: kind || 'ok'
                }, '*');
            }
        } catch (e) { /* file:// */ }
    }

    function showReportToast(message, kind) {
        var el = document.getElementById('report-toast');
        if (toastTimer) clearTimeout(toastTimer);
        if (el) {
            el.textContent = message;
            el.className = 'no-print report-toast-visible report-toast-' + (kind || 'ok');
            toastTimer = setTimeout(function () {
                el.className = 'no-print report-toast-hidden report-toast-' + (kind || 'ok');
            }, 3200);
        }
        notifyParentToast(message, kind);
    }

    function documentTargetLabel(target) {
        if (target === 'summary') return 'test summary';
        if (target === 'full') return 'full report';
        if (target === 'charts') return 'charts';
        if (target === 'both') return 'summary and full report';
        return String(target || 'report');
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                var ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) resolve();
                else reject(new Error('copy failed'));
            } catch (e) {
                reject(e);
            }
        });
    }

    function shouldPreferClipboardShare() {
        if (document.body.classList.contains('wsapp-visual-embed')) return true;
        if (!navigator.share) return true;
        try {
            if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function loadUtilityFallback() {
        try {
            return localStorage.getItem('wsapp_current_utility') || 'GENERAL';
        } catch (e) {
            return 'GENERAL';
        }
    }

    function getLocationId(report) {
        return str(report.location_id) || str(report.location_number) || str(report.locate_number) ||
            str(report.map_location_number) || str(report.location);
    }

    function getMemberCustomerName(report) {
        return str(report.member_customer_id) || str(report.customer_member_id) ||
            str(report.customer_name) || str(report.customer) || str(report.member);
    }

    function formatVisitDateTime(report) {
        var parts = [str(report.visit_date), str(report.time_in)].filter(Boolean);
        return parts.join(' · ');
    }

    function formatSummaryTestDateTime(report) {
        var date = formatSummaryTestDate(report);
        var time = formatSummaryTestTime(report);
        if (date !== '—' && time !== '—') return date + ' | ' + time;
        return date !== '—' ? date : time;
    }

    function formatSummaryTestDate(report) {
        return str(report.visit_date) || '—';
    }

    function formatSummaryTestTime(report) {
        var time = str(report.time_in);
        if (time && str(report.time_out)) {
            return time + ' – ' + str(report.time_out);
        }
        return time || str(report.time_out) || '—';
    }

    function formatKwhKwMultiplierSummary(report, C) {
        return formatMultiplierSummary(report, C);
    }

    function buildSiteIdentityHeader(locationId, memberName) {
        return '<div class="report-site-identity">' +
            '<div class="report-site-identity-row">' +
            '<span class="report-site-identity-label">Location ID</span>' +
            '<span class="report-site-identity-value">' + val(locationId) + '</span></div>' +
            '<div class="report-site-identity-row">' +
            '<span class="report-site-identity-label">Member / Customer</span>' +
            '<span class="report-site-identity-value">' + val(memberName) + '</span></div>' +
            '</div>';
    }

    function shouldShowPrimaryVoltsSummary(report, C) {
        return hasPtRecords(report) && C.isHighVoltagePtService && !C.isHighVoltagePtService(report);
    }

    function formatPrimaryVoltsSummary(report, C) {
        var form = C.getReportForm(report);
        var keys = C.isSelfContainedMeterForm(form)
            ? ['primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca']
            : ['primary_volts_an', 'primary_volts_bn', 'primary_volts_cn'];
        var vals = keys.map(function (k) { return str(report[k]); }).filter(Boolean);
        return vals.length ? formatPipeValues(vals) : '—';
    }

    function formatCtBurdenZeroCurrentSummary(report, C, field) {
        var cts = (report && report.cts) || [];
        if (!cts.length) return '—';
        var vals = [];
        for (var i = 0; i < 3; i++) {
            var ct = cts[i];
            if (!ct) {
                vals.push('');
                continue;
            }
            if (C.ensureCtBurdenGrid) C.ensureCtBurdenGrid(ct);
            var row = ct.burden && ct.burden['0.0'];
            vals.push(row ? str(row[field]) : '');
        }
        return vals.some(str) ? formatPipeValues(vals) : '—';
    }

    function getFilledTransformerCount(report) {
        var trans = (report && report.transformers) || [];
        var count = 0;
        for (var i = 0; i < 3; i++) {
            if (str((trans[i] || {}).size)) count++;
        }
        return count;
    }

    function getTransformerKvaSummaryLabel(report) {
        var count = getFilledTransformerCount(report);
        if (count <= 1) return 'Transformer KVA';
        if (count === 2) return 'Transformer KVA (T1 | T2 | Ttotal)';
        return 'Transformer KVA (T1 | T2 | T3 | Ttotal)';
    }

    function formatTransformerKvaPipeSummary(report, C) {
        if (C.isPrimaryServiceTransType && C.isPrimaryServiceTransType(report)) return '—';
        var trans = (report && report.transformers) || [];
        var sizes = [];
        for (var i = 0; i < 3; i++) {
            var size = str((trans[i] || {}).size);
            if (size) sizes.push(size);
        }
        if (!sizes.length) return '—';
        if (sizes.length === 1) return sizes[0];
        var total = C.computeTotalTransformerKva ? C.computeTotalTransformerKva(report) : '';
        var parts = sizes.slice();
        if (total) parts.push(total);
        return parts.join(' | ');
    }

    function formatThdCombinedSummary(voltageThd, currentThd) {
        var v = voltageThd != null ? voltageThd : '—';
        var c = currentThd != null ? currentThd : '—';
        if (v === '—' && c === '—') return '—';
        return String(v) + ' | ' + String(c);
    }

    function isCriticalHighNote(line) {
        var lower = String(line || '').toLowerCase();
        return ['broken', 'out of calibration', 'stolen', 'damaged', 'wont test', "won't test", 'unable to test'].some(function (k) {
            return lower.indexOf(k) !== -1;
        });
    }

    function formatGeneratedTimestamp(iso) {
        if (!iso) return new Date().toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return '';
        }
    }

    function triggerBrowserDownload(blob, filename) {
        var doc = document;
        var url = URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        doc.body.appendChild(a);
        a.click();
        setTimeout(function () {
            try { doc.body.removeChild(a); } catch (e) { /* ignore */ }
            URL.revokeObjectURL(url);
        }, 300);
    }

    function parseMeterTestPercent(value) {
        var n = parseFloat(String(value || '').replace(/,/g, '').trim());
        return isFinite(n) ? n : null;
    }

    function getMeterTestResultTier(value) {
        var n = parseMeterTestPercent(value);
        if (n === null) return 'empty';
        var badLo = 100 - METER_TEST_TIER_BANDS.badOuter;
        var badHi = 100 + METER_TEST_TIER_BANDS.badOuter;
        var warnLo = 100 - METER_TEST_TIER_BANDS.warnOuter;
        var warnHi = 100 + METER_TEST_TIER_BANDS.warnOuter;
        if (n > badHi || n < badLo) return 'bad';
        if (n > warnHi || n < warnLo) return 'warn';
        return 'ok';
    }

    function meterTestTierPlain(tier) {
        if (tier === 'ok') return 'within tolerance';
        if (tier === 'warn') return 'review band — slightly outside ideal';
        if (tier === 'bad') return 'outside tolerance — action recommended';
        return 'not tested';
    }

    function getMeterTestResultClass(tier) {
        if (tier === 'ok') return 'report-meter-test-ok';
        if (tier === 'warn') return 'report-meter-test-warn';
        if (tier === 'bad') return 'report-meter-test-bad';
        return '';
    }

    function getInstrumentAccuracyResultClass(tier) {
        if (tier === 'ok') return 'report-meter-test-ok';
        if (tier === 'warn') return 'report-meter-test-warn';
        if (tier === 'bad') return 'report-meter-test-bad';
        return '';
    }

    function buildInstrumentAccuracyPill(label, display, tier, primary) {
        var cls = getInstrumentAccuracyResultClass(tier);
        if (primary) cls += ' report-meter-test-primary';
        return '<span class="report-meter-test-pill ' + cls + '" role="status">' +
            '<span class="lbl">' + escapeHtml(label) + (primary ? ' ★' : '') + ':</span>' +
            '<span class="num">' + escapeHtml(display) + '</span></span>';
    }

    function buildAccuracyPhaseTableCell(display, tier) {
        var cls = getInstrumentAccuracyResultClass(tier);
        return '<td class="report-acc-phase-val' + (cls ? ' ' + cls : '') + '">' + escapeHtml(display) + '</td>';
    }

    function getAccuracyMethodTotalDisplay(method, C) {
        if (!method || !method.hasData) return { display: '—', tier: 'empty' };
        if (method.phases.length === 1) {
            return { display: method.phases[0].display, tier: method.phases[0].tier };
        }
        var display = C.formatAccuracyMethodTotalDisplay
            ? C.formatAccuracyMethodTotalDisplay(method)
            : (method.average != null ? C.formatInstrumentAccuracyDisplay(method.average) : '—');
        return { display: display, tier: method.averageTier };
    }

    function buildAccuracyMethodPhaseTable(method, C) {
        if (!method.hasData) {
            return '<p class="text-xs text-slate-500">No data for this method.</p>';
        }
        var html = '<table class="report-acc-phase-table" role="table" aria-label="' + escapeHtml(method.label) + '">' +
            '<thead><tr><th scope="col">Phase</th><th scope="col">Result</th></tr></thead><tbody>';
        method.phases.forEach(function (ph) {
            html += '<tr><th scope="row">Phase ' + escapeHtml(ph.phase) + '</th>' +
                buildAccuracyPhaseTableCell(ph.display, ph.tier) + '</tr>';
        });
        if (method.phases.length > 1) {
            var total = getAccuracyMethodTotalDisplay(method, C);
            html += '<tr class="report-acc-phase-total"><th scope="row">Total</th>' +
                buildAccuracyPhaseTableCell(total.display, total.tier) + '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }

    function buildAccuracyMethodsTotalTable(methods, C, ariaLabel) {
        var rows = (methods || []).filter(function (m) { return m.hasData; });
        if (!rows.length) {
            return '<p class="text-xs text-slate-500">No accuracy data available.</p>';
        }
        var html = '<table class="report-acc-phase-table" role="table" aria-label="' + escapeHtml(ariaLabel || 'Accuracy methods') + '">' +
            '<thead><tr><th scope="col">Method</th><th scope="col">Total</th></tr></thead><tbody>';
        rows.forEach(function (method) {
            var total = getAccuracyMethodTotalDisplay(method, C);
            html += '<tr><th scope="row">' + escapeHtml(method.label) + '</th>' +
                buildAccuracyPhaseTableCell(total.display, total.tier) + '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function buildMeterAccuracyPhaseTable(meter, C) {
        if (!meter || meter.skipped || !meter.hasData) return '';
        var html = '<table class="report-acc-phase-table" role="table" aria-label="Meter accuracy tests">' +
            '<thead><tr><th scope="col">Test</th><th scope="col">Result</th></tr></thead><tbody>';
        meter.items.forEach(function (item) {
            var display = item.value != null ? item.value.toFixed(3) + '%' : '—';
            var rowCls = item.primary ? ' class="report-acc-phase-total"' : '';
            html += '<tr' + rowCls + '><th scope="row">' + escapeHtml(item.label) +
                (item.primary ? ' ★' : '') + '</th>' +
                buildAccuracyPhaseTableCell(display, item.tier) + '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function buildCtAccuracyMethodBlock(method, C) {
        var html = '<div class="report-subsection" style="margin-top:0.5rem;padding-top:0.5rem">' +
            '<div class="report-subsection-title">' + escapeHtml(method.label) + '</div>' +
            '<p class="text-xs text-slate-600 mb-2">' + escapeHtml(method.description) + '</p>';
        html += buildAccuracyMethodPhaseTable(method, C);
        html += '</div>';
        return html;
    }

    function isExcludedAccuracyMethod(method) {
        return method && method.id === 'class_bands';
    }

    function buildCtAccuracyMethodsHtml(report, C) {
        if (!C.computeCtAccuracyMethodsComparison) {
            return '<p class="text-xs text-slate-500">CT accuracy methods unavailable.</p>';
        }
        var comparison = C.computeCtAccuracyMethodsComparison(report);
        var visible = (comparison.methods || []).filter(function (method) {
            return method.hasData && !isExcludedAccuracyMethod(method);
        });
        if (!visible.length) {
            return '<p class="text-xs text-slate-500">No CT burden accuracy data available.</p>';
        }
        var html = '<p class="text-xs text-slate-600 mb-2">Compare scoring methods (+1% primary transducer margin on all except Weighted Burden Avg).</p>';
        visible.forEach(function (method) {
            html += buildCtAccuracyMethodBlock(method, C);
        });
        return html;
    }

    function buildPtAccuracyMethodsHtml(report, C) {
        if (!C.computePtAccuracyMethodsComparison) {
            return '<p class="text-xs text-slate-500">PT accuracy methods unavailable.</p>';
        }
        var comparison = C.computePtAccuracyMethodsComparison(report);
        var visible = (comparison.methods || []).filter(function (method) {
            return method.hasData && !isExcludedAccuracyMethod(method);
        });
        if (!visible.length) {
            return '<p class="text-xs text-slate-500">No PT/VT burden accuracy data available.</p>';
        }
        var html = '<p class="text-xs text-slate-600 mb-2">Compare scoring methods on VA burden data (no transducer margin — voltage readings).</p>';
        visible.forEach(function (method) {
            html += buildCtAccuracyMethodBlock(method, C);
        });
        return html;
    }

    function formatRegisterReading(label, value) {
        return label + ' ' + (str(value) || '-');
    }

    function formatPipeValues(values, sep) {
        sep = sep || ' | ';
        return values.map(function (v) { return str(v) || '—'; }).join(sep);
    }

    function getReportNoteLines(report, priority) {
        var text = priority === 'high'
            ? str(report.field_report_notes_high)
            : (str(report.field_report_notes_info) || str(report.notes));
        if (!text) return [];
        return text.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    }

    function countHighPriorityNotes(report) {
        return getReportNoteLines(report, 'high').length;
    }

    function lineMatchesAny(line, matchers) {
        var lower = line.toLowerCase();
        return matchers.some(function (m) { return lower.indexOf(String(m).toLowerCase()) !== -1; });
    }

    function collectSectionNotes(report, matchers, otherMatchers) {
        var high = [];
        var info = [];
        getReportNoteLines(report, 'high').forEach(function (line) {
            if (lineMatchesAny(line, matchers)) high.push(line);
        });
        getReportNoteLines(report, 'info').forEach(function (line) {
            if (lineMatchesAny(line, matchers)) info.push(line);
        });
        if (otherMatchers) {
            getReportNoteLines(report, 'high').forEach(function (line) {
                if (!lineMatchesAny(line, matchers) && lineMatchesAny(line, otherMatchers)) { /* skip */ }
            });
        }
        return { high: high, info: info };
    }

    function renderSectionNotesBlock(notes, emptyLabel) {
        if (!notes.high.length && !notes.info.length) {
            return '<div class="text-sm text-slate-600">' + escapeHtml(emptyLabel || 'None') + '</div>';
        }
        var html = '';
        notes.high.forEach(function (line) {
            html += '<div class="report-note-high">' + escapeHtml(line) + '</div>';
        });
        notes.info.forEach(function (line) {
            html += '<div class="report-note-info">' + escapeHtml(line) + '</div>';
        });
        return html;
    }

    function getActiveTransformers(report) {
        var trans = (report && report.transformers) || [];
        return trans.filter(function (t, i) {
            return !!(str(t.size) || str(t.mfg) || str(t.serial_number) || str(t.primary_voltage) ||
                str(t.secondary_voltage) || str(t.impedance) || str(t.mfg_year) || t.t_number || i === 0);
        });
    }

    function normalizeReportForDisplay(report, C) {
        if (!report || !C) return report;
        var r = report;

        var locId = getLocationId(r);
        if (locId) {
            r.location_id = locId;
            if (!str(r.location_number)) r.location_number = locId;
        }
        if (!str(r.service_desc) && str(r.service_description)) {
            r.service_desc = r.service_description;
        }
        if (!str(r.listed_multiplier) && str(r.multiplier)) {
            r.listed_multiplier = r.multiplier;
        }
        if (!str(r.form) && str(r.meter_form)) {
            r.form = r.meter_form;
        }
        if (r.meter_bad_display !== 'YES') {
            r.meter_bad_display = 'NO';
        }

        if (C.applySelfContainedPrimaryVoltMirror) {
            C.applySelfContainedPrimaryVoltMirror(r);
        }
        if (C.applyMultiplierCalculations) {
            C.applyMultiplierCalculations(r);
        }
        return r;
    }

    function importItemLabel(report, meta) {
        var loc = getLocationId(report) || 'Site';
        var meter = str(report.meter_number);
        var when = formatVisitDateTime(report) || (meta && meta.saved_at ? formatGeneratedTimestamp(meta.saved_at) : '');
        return [loc, meter, when].filter(Boolean).join(' · ');
    }

    function listImportableReports(raw) {
        if (!raw || typeof raw !== 'object') return [];
        if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
            return [{
                report: raw.data,
                utility: raw.utility || raw.current_utility || loadUtilityFallback(),
                meta: { saved_at: raw.saved_at || raw.exported_at || '', report_id: raw.report_id || '' },
                label: importItemLabel(raw.data, { saved_at: raw.saved_at, report_id: raw.report_id })
            }];
        }
        if (Array.isArray(raw.data_store)) {
            return raw.data_store.filter(function (e) {
                return e && e.type === 'field_report' && !e.is_draft && e.data;
            }).map(function (e) {
                var meta = { saved_at: e.created || raw.exported_at || '', report_id: e.id || '' };
                return {
                    report: e.data,
                    utility: e.utility || raw.current_utility || loadUtilityFallback(),
                    meta: meta,
                    label: importItemLabel(e.data, meta)
                };
            });
        }
        if (raw.form || raw.location_number || raw.meter_number || raw.service_location) {
            return [{
                report: raw,
                utility: raw.utility || loadUtilityFallback(),
                meta: { saved_at: '', report_id: '' },
                label: importItemLabel(raw, {})
            }];
        }
        return [];
    }

    /** Parse backup JSON, active-report payload, or raw field-report data object. */
    function parseImportedReportPayload(raw) {
        var items = listImportableReports(raw);
        if (!items.length) return null;
        return items[items.length - 1];
    }

    function publishImportedReport(parsed) {
        if (!parsed || !parsed.report) return false;
        try {
            localStorage.setItem('wsapp_active_field_report', JSON.stringify({
                saved_at: new Date().toISOString(),
                report_id: parsed.meta && parsed.meta.report_id ? parsed.meta.report_id : 'imported',
                utility: parsed.utility || loadUtilityFallback(),
                data: parsed.report
            }));
            if (parsed.utility) {
                localStorage.setItem('wsapp_current_utility', parsed.utility);
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    function showReportImportPicker(items, onPick) {
        var overlay = document.createElement('div');
        overlay.className = 'report-picker-overlay no-print';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Choose a completed field report');

        var card = document.createElement('div');
        card.className = 'report-picker-card';
        card.innerHTML = '<div class="px-4 py-3 border-b font-semibold text-slate-800 text-sm">Choose a completed test</div>';

        var list = document.createElement('div');
        list.className = 'report-picker-list';

        items.slice().reverse().forEach(function (item) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'report-picker-item';
            btn.textContent = item.label;
            btn.onclick = function () {
                document.body.removeChild(overlay);
                onPick(item);
            };
            list.appendChild(btn);
        });

        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'mx-3 mb-3 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50';
        cancel.textContent = 'Cancel';
        cancel.onclick = function () {
            document.body.removeChild(overlay);
        };

        card.appendChild(list);
        card.appendChild(cancel);
        overlay.appendChild(card);
        overlay.addEventListener('click', function (ev) {
            if (ev.target === overlay) document.body.removeChild(overlay);
        });
        document.body.appendChild(overlay);
        var first = list.querySelector('.report-picker-item');
        if (first) first.focus();
    }

    function finishImport(parsed) {
        if (!parsed || !parsed.report) {
            showReportToast('Could not find a field report in that JSON file.', 'error');
            return;
        }
        if (!publishImportedReport(parsed)) {
            showReportToast('Could not store report for display.', 'error');
            return;
        }
        showReportToast('Report loaded.', 'ok');
        render();
    }

    function promptLoadReportJson() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = function () {
            var file = input.files && input.files[0];
            document.body.removeChild(input);
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var raw = JSON.parse(String(reader.result || ''));
                    var items = listImportableReports(raw);
                    if (!items.length) {
                        showReportToast('Could not find a field report in that JSON file.', 'error');
                        return;
                    }
                    if (items.length === 1) {
                        finishImport(items[0]);
                        return;
                    }
                    showReportImportPicker(items, finishImport);
                } catch (e) {
                    showReportToast('Invalid JSON file.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function utilityDisplayName(key) {
        if (window.WSAPP_UTILITY_DISPLAY_NAME) return window.WSAPP_UTILITY_DISPLAY_NAME(key);
        return key || 'General';
    }

    function utilityAddress(key) {
        if (window.WSAPP_FORMAT_UTILITY_ADDRESS) return window.WSAPP_FORMAT_UTILITY_ADDRESS(key);
        return '';
    }

    function testReasonPlain(reason) {
        var r = str(reason).toUpperCase();
        if (r.indexOf('FT') === 0) return 'Routine field test';
        if (r.indexOf('FR') === 0) return 'Verification test (CT3)';
        if (r.indexOf('MR') === 0) return 'Member-requested complaint test';
        return str(reason) || '—';
    }

    function phasePlain(report, C) {
        var p = C.getReportPhase(report);
        if (p === '3') return '3-phase';
        if (p === '1') return '1-phase';
        return str(report.phase) || '—';
    }

    function serviceDescPlain(report) {
        return str(report.service_desc);
    }

    function badgeHtml(innerHtml, kind) {
        var cls = kind === 'ok' ? 'report-badge-ok' : (kind === 'warn' ? 'report-badge-warn' : 'report-badge-neutral');
        return '<span class="report-badge ' + cls + '">' + innerHtml + '</span>';
    }

    function multiplierMatchInline(match) {
        if (match === 'YES') return '<span class="report-match-ok">(matches)</span>';
        if (match === 'NO') return '<span class="report-match-bad">(does not match)</span>';
        return '';
    }

    function multiplierMatchBadge(match) {
        if (match === 'YES') {
            return badgeHtml('<i class="fa-solid fa-check" aria-hidden="true"></i> Multiplier matches nameplate', 'ok');
        }
        if (match === 'NO') {
            return badgeHtml('<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Multiplier does not match nameplate', 'warn');
        }
        return badgeHtml(escapeHtml('Multiplier check — insufficient data'), 'neutral');
    }

    function multiplierAccountValue(report, C) {
        var listed = C.getListedMultiplier(report);
        var calc = report.calculated_multiplier || C.computeCalculatedMultiplier(report);
        var parts = [];
        if (listed) parts.push('Listed: ' + escapeHtml(listed));
        if (calc) parts.push('Calculated: ' + escapeHtml(String(calc)));
        if (!parts.length) return '<span class="text-slate-400">—</span>';
        return parts.join(' · ') + ' ' + multiplierMatchInline(report.multiplier_match);
    }

    function kvRow(label, value) {
        return '<dt>' + escapeHtml(label) + '</dt><dd>' + val(value) + '</dd>';
    }

    function section(title, bodyHtml, extraClass, lede, sectionId) {
        var ledeHtml = lede ? '<p class="report-lede">' + escapeHtml(lede) + '</p>' : '';
        var idAttr = sectionId ? ' id="' + escapeHtml(sectionId) + '"' : '';
        return '<section class="report-section report-section-card report-full-section ' + (extraClass || '') + '"' + idAttr +
            ' data-section="' + escapeHtml(title) + '">' +
            '<h2 class="report-heading-section report-section-heading">' + escapeHtml(title) + '</h2>' +
            ledeHtml + bodyHtml + '</section>';
    }

    function collapsibleSection(title, bodyHtml, sectionId, opts) {
        opts = opts || {};
        var openAttr = opts.defaultOpen ? ' open' : '';
        return '<details class="report-technical-details report-section report-section-card report-full-section"' +
            ' id="' + escapeHtml(sectionId) + '" data-section="' + escapeHtml(title) + '"' + openAttr + '>' +
            '<summary class="report-technical-summary">' +
            '<span class="report-heading-section report-section-heading report-technical-heading">' + escapeHtml(title) + '</span>' +
            '<span class="report-technical-hint">Show / hide</span></summary>' +
            '<div class="report-technical-body">' + bodyHtml + '</div></details>';
    }

    function technicalSection(title, bodyHtml, lede, sectionId) {
        return collapsibleSection(title,
            (lede ? '<p class="report-lede">' + escapeHtml(lede) + '</p>' : '') + bodyHtml,
            sectionId);
    }

    function kvGrid(rows) {
        return '<dl class="report-kv">' + rows.join('') + '</dl>';
    }

    function summaryTile(label, value, mono) {
        return '<div class="report-summary-tile">' +
            '<div class="label">' + escapeHtml(label) + '</div>' +
            '<div class="value' + (mono ? ' font-mono' : '') + '">' + val(value) + '</div></div>';
    }

    function chartBlock(svgHtml, borderClass) {
        return '<div class="report-chart bg-slate-50 rounded-xl p-2 border ' + (borderClass || 'border-slate-200') + ' mb-3" role="img" aria-label="Engineering chart">' + svgHtml + '</div>';
    }

    function noDataChartPlaceholder(msg) {
        return '<div class="report-chart bg-slate-50 rounded-xl p-8 border border-dashed border-slate-300 mb-3 text-center text-sm text-slate-500">' +
            escapeHtml(msg || 'No chart data for this test') + '</div>';
    }

    function hasBurdenChartPhases(cfg) {
        return !!(cfg && cfg.phases && cfg.phases.length);
    }

    function formatPf(pf) {
        if (pf == null || pf === '') return '—';
        var n = Number(pf);
        if (isNaN(n)) return String(pf);
        return n.toFixed(3);
    }

    function averageNumeric(values) {
        var nums = (values || []).map(function (v) {
            var n = parseFloat(String(v).replace(/,/g, ''));
            return isFinite(n) ? n : null;
        }).filter(function (n) { return n !== null; });
        if (!nums.length) return null;
        return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
    }

    function formatCtRatioDisplay(ratio) {
        var r = str(ratio);
        if (!r) return '';
        return r.indexOf(':') === -1 ? r + ':5' : r;
    }

    function formatMultiplierSummary(report, C) {
        var listed = C.getListedMultiplier(report);
        var calc = report.calculated_multiplier || C.computeCalculatedMultiplier(report);
        var use = listed || calc || '';
        if (!use) return '—';
        var src = listed ? 'nameplate' : 'calculated';
        if (listed && calc && String(listed) !== String(calc)) {
            return escapeHtml(String(listed)) + ' (nameplate) · ' + escapeHtml(String(calc)) + ' (calculated)';
        }
        return escapeHtml(String(use)) + ' (' + src + ')';
    }

    function formatSecondaryVoltsSummary(report, C) {
        var form = C.getReportForm(report);
        var keys = C.isSelfContainedMeterForm(form)
            ? ['secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca']
            : ['secondary_volts_an', 'secondary_volts_bn', 'secondary_volts_cn'];
        var vals = keys.map(function (k) { return str(report[k]); }).filter(Boolean);
        return vals.length ? formatPipeValues(vals) : '—';
    }

    function formatAmpsSummary(report, prefix) {
        var vals = ['a', 'b', 'c'].map(function (ph) {
            return str(report[prefix + '_amps_' + ph]);
        });
        return vals.some(str) ? formatPipeValues(vals) : '—';
    }

    function computeCtOverallAccuracy(report, C) {
        if (!C.computeCtAccuracyBreakdown) return null;
        var breakdown = C.computeCtAccuracyBreakdown(report);
        if (!breakdown || !breakdown.hasData) return null;
        if (C.computeLoadWeightedInstrumentPct) {
            var weighted = C.computeLoadWeightedInstrumentPct(breakdown.phases, report);
            if (weighted != null) return weighted;
        }
        return breakdown.average;
    }

    function computePtOverallAccuracy(report, C) {
        if (!C.computePtAccuracyBreakdown) return null;
        var breakdown = C.computePtAccuracyBreakdown(report);
        if (!breakdown || !breakdown.hasData) return null;
        if (C.computeLoadWeightedInstrumentPct) {
            var weighted = C.computeLoadWeightedInstrumentPct(breakdown.phases, report);
            if (weighted != null) return weighted;
        }
        return breakdown.average;
    }

    function computeOverallServiceAccuracy(report, C, meterPct, ctPct, ptPct) {
        if (C.computeRegistrationImpact) {
            var impact = C.computeRegistrationImpact(report);
            if (impact && impact.hasData && impact.siteRegistrationPct != null) {
                return impact.siteRegistrationPct;
            }
        }
        if (meterPct == null || !isFinite(meterPct)) return null;
        var factor = meterPct / 100;
        if (hasCtRecords(report) && ctPct != null) factor *= ctPct / 100;
        if (hasPtRecords(report) && ptPct != null) factor *= ptPct / 100;
        return factor * 100;
    }

    function computeSummaryData(report, C) {
        report = normalizeReportForDisplay(report, C);
        var pf = C.getCalculatedPowerFactors(report);
        var meterWeighted = parseMeterTestPercent(report.as_found_weighted_average);
        var ctAcc = computeCtOverallAccuracy(report, C);
        var ptAcc = hasPtRecords(report) ? computePtOverallAccuracy(report, C) : null;
        var timedKw = C.formatTimedRevKwDisplay
            ? C.formatTimedRevKwDisplay(C.computeTimedRevKwSimple(report.as_found_timed_revolutions, report))
            : '';
        var meterKw = timedKw && timedKw !== '—' ? timedKw : str(report.kw);
        var transKva = C.computeTotalTransformerKva ? C.computeTotalTransformerKva(report) : '';

        var voltageThd = averageNumeric([
            report.voltage_thd_an, report.voltage_thd_bn, report.voltage_thd_cn,
            report.voltage_thd_ab, report.voltage_thd_bc, report.voltage_thd_ca
        ]);
        var currentThd = averageNumeric([
            report.current_thd_a, report.current_thd_b, report.current_thd_c
        ]);

        var ctRatios = (report.cts || []).map(function (ct) {
            return formatCtRatioDisplay(ct.ratio_size);
        }).filter(Boolean);
        var ptRatios = (report.pts || []).map(function (pt) {
            return str(pt.ratio_size);
        }).filter(Boolean);

        var hasPt = hasPtRecords(report);
        var showPrimaryVolts = shouldShowPrimaryVoltsSummary(report, C);

        return {
            testDateTime: formatSummaryTestDateTime(report),
            testDate: formatSummaryTestDate(report),
            testTime: formatSummaryTestTime(report),
            serviceDescription: serviceDescPlain(report),
            locationId: getLocationId(report),
            accountId: str(report.account_number),
            meterNumber: str(report.meter_number),
            memberName: getMemberCustomerName(report),
            multiplierKwhKw: formatKwhKwMultiplierSummary(report, C),
            meterForm: C.getReportForm(report),
            meterKwh: str(report.kwh),
            meterKw: meterKw || '—',
            meterWeightedAccuracy: meterWeighted != null ? meterWeighted.toFixed(3) + '%' : (str(report.meter_test_skip) ? 'Skipped' : '—'),
            showPrimaryVolts: showPrimaryVolts,
            primaryVolts: showPrimaryVolts ? formatPrimaryVoltsSummary(report, C) : null,
            secondaryVolts: formatSecondaryVoltsSummary(report, C),
            primaryCurrentZeroBurden: formatCtBurdenZeroCurrentSummary(report, C, 'pri'),
            secondaryCurrentZeroBurden: formatCtBurdenZeroCurrentSummary(report, C, 'sec'),
            ctRatio: ctRatios.length ? ctRatios.join(' | ') : '—',
            ctAccuracy: ctAcc != null ? ctAcc.toFixed(1) + '%' : '—',
            hasPt: hasPt,
            ptRatio: hasPt ? (ptRatios.length ? ptRatios.join(' | ') : '—') : null,
            ptAccuracy: hasPt ? (ptAcc != null ? ptAcc.toFixed(1) + '%' : '—') : null,
            serviceAccuracy: (function () {
                var v = computeOverallServiceAccuracy(report, C, meterWeighted, ctAcc, ptAcc);
                return v != null ? v.toFixed(3) + '%' : '—';
            })(),
            registrationLoss: (function () {
                if (!C.computeRegistrationImpact) return null;
                var impact = C.computeRegistrationImpact(report);
                if (!impact || !impact.showImpact || impact.lossPct == null) return null;
                return impact.lossPct.toFixed(3) + '%';
            })(),
            powerFactor: formatPf(pf.average),
            thdCombined: formatThdCombinedSummary(
                voltageThd != null ? voltageThd.toFixed(2) + '%' : null,
                currentThd != null ? currentThd.toFixed(2) + '%' : null
            ),
            transformerKvaPipe: formatTransformerKvaPipeSummary(report, C),
            transformerKvaLabel: getTransformerKvaSummaryLabel(report),
            highNotes: getReportNoteLines(report, 'high'),
            infoNotes: getReportNoteLines(report, 'info'),
            meterSkipped: !!str(report.meter_test_skip)
        };
    }

    function summaryKvRow(label, valueHtml) {
        return '<dt>' + escapeHtml(label) + '</dt><dd>' + valueHtml + '</dd>';
    }

    function buildSummaryNotesBlock(lines, emptyText) {
        if (!lines.length) return '<div class="report-empty">' + escapeHtml(emptyText) + '</div>';
        return lines.map(function (line) {
            return '<div class="report-note-info">' + escapeHtml(line) + '</div>';
        }).join('');
    }

    function buildSummaryHighNotesBlock(lines) {
        if (!lines.length) return '<div class="report-empty">None</div>';
        var critical = lines.some(isCriticalHighNote);
        var boxCls = 'summary-high-notes-alert' + (critical ? ' summary-high-notes-alert-critical' : '');
        return '<div class="' + boxCls + '" role="alert">' + lines.map(function (line) {
            return '<div class="summary-high-note-line">' + escapeHtml(line) + '</div>';
        }).join('') + '</div>';
    }

    function buildSummaryLetterheadHtml(utilName, utilAddr, locationId, memberName) {
        var whs = WATTHOUR_BUSINESS;
        var whsAddr = [whs.address, whs.city + ', ' + whs.state + ' ' + whs.zip].join(' · ');
        return '<header class="summary-letterhead" role="banner">' +
            '<div class="summary-letterhead-grid">' +
            '<div class="summary-letterhead-util">' +
            '<div class="summary-party-name">' + escapeHtml(utilName || 'Utility') + '</div>' +
            (utilAddr ? '<div class="summary-party-address">' + escapeHtml(utilAddr) + '</div>' : '') +
            '</div>' +
            '<div class="summary-letterhead-center">' +
            '<div class="summary-letterhead-site">' +
            '<div class="summary-letterhead-site-row">' +
            '<span class="summary-letterhead-site-label">Location ID</span>' +
            '<span class="summary-letterhead-site-value">' + val(locationId) + '</span></div>' +
            '<div class="summary-letterhead-site-row">' +
            '<span class="summary-letterhead-site-label">Member / Customer</span>' +
            '<span class="summary-letterhead-site-value">' + val(memberName) + '</span></div>' +
            '</div>' +
            '<img src="' + escapeHtml(whs.logo) + '" alt="Watthour Solutions logo" class="summary-logo-large" onerror="this.style.display=\'none\'">' +
            '</div>' +
            '<div class="summary-letterhead-whs">' +
            '<div class="summary-brand-name">' + escapeHtml(whs.name) + '</div>' +
            '<div class="summary-brand-address">' + escapeHtml(whsAddr) + '</div>' +
            '</div></div></header>';
    }

    function buildSummaryGroup(title, rows, headerHtml) {
        var filtered = rows.filter(Boolean);
        if (!filtered.length && !headerHtml) return '';
        return '<div class="summary-field-group">' +
            '<h3 class="report-heading-section">' + escapeHtml(title) + '</h3>' +
            (headerHtml || '') +
            '<dl class="summary-kv">' + filtered.join('') + '</dl></div>';
    }

    function buildSummaryAccountGroup(d, report) {
        return buildSummaryGroup('Account Summary', [
            summaryKvRow('Test Date', val(d.testDate)),
            summaryKvRow('Test Time', val(d.testTime)),
            summaryKvRow('Service Description', val(d.serviceDescription)),
            summaryKvRow('KWh and KW Multiplier', d.multiplierKwhKw + ' ' + multiplierMatchInline(report.multiplier_match))
        ]);
    }

    function buildSummaryFieldGroups(d, report) {
        var instrumentRows = [
            summaryKvRow('CT Ratio', val(d.ctRatio)),
            summaryKvRow('CT Overall Accuracy', val(d.ctAccuracy))
        ];
        if (d.hasPt) {
            instrumentRows.push(
                summaryKvRow('PT Ratio', val(d.ptRatio)),
                summaryKvRow('PT Overall Accuracy', val(d.ptAccuracy))
            );
        }
        return [
            buildSummaryAccountGroup(d, report),
            buildSummaryGroup('Meter Summary', [
                summaryKvRow('Meter ID', val(d.meterNumber)),
                summaryKvRow('Meter Form', val(d.meterForm)),
                summaryKvRow('Meter KWh (at test)', val(d.meterKwh)),
                summaryKvRow('Meter KW (at test)', val(d.meterKw)),
                summaryKvRow('Meter Weighted Accuracy', val(d.meterWeightedAccuracy))
            ]),
            buildSummaryGroup('Usage Summary', [
                d.showPrimaryVolts ? summaryKvRow('Primary Voltages', val(d.primaryVolts)) : '',
                summaryKvRow('Secondary Voltages', val(d.secondaryVolts)),
                summaryKvRow('Primary Current (@ 0 burden)', val(d.primaryCurrentZeroBurden)),
                summaryKvRow('Secondary Current (@ 0 burden)', val(d.secondaryCurrentZeroBurden)),
                summaryKvRow('Measured PF', val(d.powerFactor)),
                summaryKvRow('Average Voltage THD | Current THD', val(d.thdCombined))
            ]),
            buildSummaryGroup('Equipment Summary', [
                summaryKvRow(d.transformerKvaLabel || 'Transformer KVA', val(d.transformerKvaPipe))
            ].concat(instrumentRows))
        ].join('');
    }

    function buildReportOverviewBlock(report, C) {
        var d = computeSummaryData(report, C);
        return '<div class="report-overview-block">' +
            '<div class="summary-field-groups">' + buildSummaryFieldGroups(d, report) + '</div>' +
            buildSummaryServiceAccuracyFooter(d, C, report) +
            '<div class="summary-notes-block summary-notes-panel"><h3 class="report-heading-section">High-priority notes</h3>' +
            buildSummaryHighNotesBlock(d.highNotes) + '</div>' +
            '<div class="summary-notes-block summary-notes-panel"><h3 class="report-heading-section">Informational notes</h3>' +
            buildSummaryNotesBlock(d.infoNotes, 'None recorded') + '</div>' +
            '</div>';
    }

    function buildSummarySection(report, C) {
        var utilName = utilityDisplayName(state.utility);
        var utilAddr = utilityAddress(state.utility);
        var locationId = getLocationId(report);
        var memberName = getMemberCustomerName(report);

        return '<section id="section-summary" class="report-document-summary" data-section="Summary">' +
            buildSummaryLetterheadHtml(utilName, utilAddr, locationId, memberName) +
            '<h1 class="report-heading-doc summary-title">Meter Test Summary — Overall Assessment</h1>' +
            '<p class="summary-title-sub">Field test results for office staff and members — one-page overview of site visit findings.</p>' +
            buildReportOverviewBlock(report, C) +
            '</section>';
    }

    function buildMeterTierLegend() {
        var b = METER_TEST_TIER_BANDS;
        return '<div class="report-tier-legend" role="note">' +
            '<strong>Meter test color guide:</strong> ' +
            '<span class="report-meter-test-pill report-meter-test-ok"><span class="lbl">OK</span></span> ' +
            (100 - b.warnOuter).toFixed(1) + '–' + (100 + b.warnOuter).toFixed(1) + '% · ' +
            '<span class="report-meter-test-pill report-meter-test-warn"><span class="lbl">Review</span></span> outside ±' + b.warnOuter + '% · ' +
            '<span class="report-meter-test-pill report-meter-test-bad"><span class="lbl">Action</span></span> outside ±' + b.badOuter + '%. ' +
            escapeHtml(b.reference) + '.' +
            '</div>';
    }

    function computeExecutiveFindings(report, C) {
        report = normalizeReportForDisplay(report, C);
        var skipped = !!str(report.meter_test_skip);
        var worstTier = 'ok';
        var testedValues = [];
        var testedLabels = [];

        METER_TEST_FIELDS.forEach(function (field) {
            if (skipped) return;
            var value = str(report[field.key]);
            if (!value) return;
            var tier = getMeterTestResultTier(value);
            testedLabels.push(field.label);
            testedValues.push(parseMeterTestPercent(value));
            if (tier === 'bad') worstTier = 'bad';
            else if (tier === 'warn' && worstTier !== 'bad') worstTier = 'warn';
        });

        var highNoteCount = countHighPriorityNotes(report);
        var meterProblemNotes = collectSectionNotes(report, METER_NOTE_MATCHERS, SOCKET_NOTE_MATCHERS);
        var hasMeterProblems = meterProblemNotes.high.length > 0 || report.meter_bad_display === 'YES';
        var multiplierMismatch = report.multiplier_match === 'NO';

        var status = 'pass';
        var title = 'Meter accuracy within tolerance';
        var subtitle = 'Results look acceptable for this visit. Review the meter section for details.';

        if (skipped) {
            status = 'neutral';
            title = 'Meter test was skipped';
            subtitle = 'No as-found accuracy readings were recorded on this visit.';
        } else if (worstTier === 'bad' || hasMeterProblems) {
            status = 'action';
            title = 'Action recommended — review details';
            subtitle = 'One or more readings or notes suggest the meter or test conditions need follow-up.';
        } else if (worstTier === 'warn' || multiplierMismatch) {
            status = 'review';
            title = 'Review recommended';
            subtitle = 'Readings are close to limits or the multiplier check needs attention.';
        }

        var bullets = [];
        if (skipped) {
            bullets.push('Meter accuracy test was not performed in the field.');
        } else if (testedValues.length) {
            var min = Math.min.apply(null, testedValues);
            var max = Math.max.apply(null, testedValues);
            bullets.push('As-found meter tests ranged from ' + min.toFixed(3) + '% to ' + max.toFixed(3) + '% (' + testedLabels.length + ' reading' + (testedLabels.length === 1 ? '' : 's') + ').');
        } else {
            bullets.push('No as-found meter accuracy percentages were recorded.');
        }

        if (report.multiplier_match === 'YES') {
            bullets.push('Billing multiplier matches the calculated value from instrument transformers.');
        } else if (report.multiplier_match === 'NO') {
            bullets.push('Billing multiplier does not match the calculated value — verify CT/PT ratios.');
        } else {
            bullets.push('Multiplier match could not be confirmed from available data.');
        }

        if (highNoteCount === 0) {
            bullets.push('No high-priority field notes were recorded.');
        } else {
            bullets.push(highNoteCount + ' high-priority note' + (highNoteCount === 1 ? '' : 's') + ' recorded — see notes sections below.');
        }

        if (hasMeterProblems && !skipped) {
            bullets.push('Meter or test problem noted — see meter notes for specifics.');
        }

        return { status: status, title: title, subtitle: subtitle, bullets: bullets, worstTier: worstTier };
    }

    function buildExecutiveVerdictBlock(report, C) {
        var findings = computeExecutiveFindings(report, C);
        var verdictClass = 'report-verdict-' + findings.status;
        var icon = findings.status === 'pass' ? 'fa-circle-check' :
            (findings.status === 'action' ? 'fa-circle-exclamation' :
                (findings.status === 'review' ? 'fa-triangle-exclamation' : 'fa-circle-info'));

        var list = findings.bullets.map(function (b) {
            return '<li>' + escapeHtml(b) + '</li>';
        }).join('');

        return '<div id="report-summary" class="report-findings">' +
            '<div class="report-verdict ' + verdictClass + '" role="status" aria-live="polite">' +
            '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>' +
            '<div><div class="report-verdict-title">' + escapeHtml(findings.title) + '</div>' +
            '<div class="report-verdict-sub">' + escapeHtml(findings.subtitle) + '</div></div></div>' +
            '<ul class="report-findings-list">' + list + '</ul></div>';
    }

    function buildExecutiveSummary(report, C) {
        return buildExecutiveVerdictBlock(report, C) + buildMeterTierLegend();
    }

    function buildAccuracyGuidanceText(report, C) {
        var findings = computeExecutiveFindings(report, C);
        var d = computeSummaryData(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var parts = [];

        if (findings.status === 'pass') {
            parts.push('Primary accuracy indicators are within expected ANSI C12.1 field-test bands for this visit.');
        } else if (findings.status === 'review') {
            parts.push('One or more readings are near tolerance limits — review detailed meter tests and CT/PT burden data before closing the ticket.');
        } else if (findings.status === 'action') {
            parts.push('Action is recommended — verify meter test results, instrument transformer ratios, and any high-priority notes before billing follow-up.');
        } else if (findings.status === 'neutral') {
            parts.push('Meter accuracy testing was not completed in the field — overall service accuracy may rely on CT/PT data only.');
        }

        if (d.registrationLoss) {
            parts.push('Registration impact modeling indicates possible under-registration — confirm multiplier and CT/PT ratios against nameplate data.');
        }
        if (!selfContained && !hasCtRecords(report)) {
            parts.push('No CT records were captured — CT burden accuracy could not be fully evaluated.');
        }
        if (report.multiplier_match === 'NO') {
            parts.push('Billing multiplier does not match the calculated value from instrument transformers — verify listed vs calculated multiplier in the meter section.');
        }

        return parts.join(' ');
    }

    function buildAssessmentSummarySection(report, C) {
        var body = buildExecutiveVerdictBlock(report, C) +
            buildTestConditionsCallout(report, C) +
            buildMeterTierLegend();
        return section('Test Assessment Summary', body,
            '', 'Plain-language interpretation of this visit and how the test was performed. Detailed measurements follow in the field data sections below.',
            'section-assessment');
    }

    function buildAccuracyBriefingSection(report, C) {
        var d = computeSummaryData(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var skipped = !!str(report.meter_test_skip);
        var rows = [
            kvRow('Meter weighted accuracy', val(d.meterWeightedAccuracy)),
            kvRowHtml('As-found meter tests', buildMeterTestPills(report))
        ];

        if (!selfContained && (hasCtRecords(report) || d.ctRatio !== '—')) {
            rows.push(kvRow('CT overall accuracy', val(d.ctAccuracy)));
            rows.push(kvRow('CT ratio(s)', val(d.ctRatio)));
        }
        if (d.hasPt) {
            rows.push(kvRow('PT overall accuracy', val(d.ptAccuracy)));
            rows.push(kvRow('PT ratio(s)', val(d.ptRatio)));
        }

        rows.push(kvRowHtml('KWh and KW multiplier', formatKwhKwMultiplierSummary(report, C) + ' ' + multiplierMatchInline(report.multiplier_match)));

        if (skipped) {
            rows.push(kvRow('Meter test status', 'Skipped in field'));
        }

        var body = buildSummaryServiceAccuracyFooter(d, C, report) +
            '<div class="report-accuracy-brief-grid">' + kvGrid(rows) + '</div>';

        return section('Accuracy Overview', body, buildAccuracyGuidanceText(report, C),
            'Composite meter, CT, and PT/VT accuracy for this site visit.', 'section-accuracy-brief');
    }

    function buildConsolidatedNotesSection(report) {
        return section('Field Notes', buildConsolidatedNotesSectionBody(report),
            '', 'All observations from the field visit. High-priority items require office or member follow-up.', 'section-notes');
    }

    function buildTestConditionsCallout(report, C) {
        var pf = C.getCalculatedPowerFactors(report);
        var testVolts = str(report.test_volts);
        var testAmps = str(report.testing_amps);
        var ampsDisplay = testAmps ? testAmps + ' A' : '';
        var phase = phasePlain(report, C);

        return '<div class="report-test-conditions" id="report-test-conditions">' +
            '<h3 class="report-heading-section">How we tested</h3>' +
            kvGrid([
                kvRow('Test voltage', testVolts || '—'),
                kvRow('Test current', ampsDisplay || '—'),
                kvRow('Service phase', phase),
                kvRow('Average power factor', formatPf(pf.average)),
                kvRow('Test reason', testReasonPlain(report.test_reason))
            ]) +
            '</div>';
    }

    function buildSectionNav(navItems) {
        if (!navItems.length) return '';
        var links = navItems.map(function (item) {
            return '<span class="report-nav-item">' +
                '<a href="#' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</a>' +
                '<button type="button" class="report-section-print no-print" data-print-section="' + escapeHtml(item.id) + '"' +
                ' aria-label="Print ' + escapeHtml(item.label) + ' section" title="Print this section only">' +
                '<i class="fa-solid fa-print" aria-hidden="true"></i></button></span>';
        }).join('');
        return '<nav class="report-section-nav no-print" aria-label="Report sections">' + links + '</nav>';
    }

    function buildReportFooter(meta, report) {
        var generated = formatGeneratedTimestamp(new Date().toISOString());
        var published = meta && meta.saved_at ? formatGeneratedTimestamp(meta.saved_at) : '';
        var reportId = meta && meta.report_id ? str(meta.report_id) : '';
        var visit = formatVisitDateTime(report);

        return '<footer class="report-meta-footer">' +
            '<p>Prepared by Watthour Solutions' +
            (getMemberCustomerName(report) ? ' for ' + escapeHtml(getMemberCustomerName(report)) : '') + '.</p>' +
            '<p>' +
            (reportId ? 'Report ID: ' + escapeHtml(reportId) + ' · ' : '') +
            'Site visit: ' + escapeHtml(visit || '—') +
            (published ? ' · Data published: ' + escapeHtml(published) : '') +
            ' · Report generated: ' + escapeHtml(generated) +
            ' · WSApp ' + escapeHtml(REPORT_PAGE_VERSION) +
            '</p>' +
            '<p class="report-meta-footer-disclaimer">Field measurements summary — not a legal certification. Contact Watthour Solutions with questions about this report.</p>' +
            '</footer>';
    }

    function getEnabledUsageFieldKeys(report, C) {
        var form = C.getReportForm(report);
        if (C.isSelfContainedMeterForm(form)) {
            return C.getSelfContainedEnabledUsageFields(report);
        }
        if (C.isFiveSUsageLayoutForm(form)) {
            return C.getFiveSEnabledUsageFields(report);
        }
        if (form === '4S' || (form === '3S' && C.getReportPhase(report) === '1')) {
            return C.ALL_USAGE_LAYOUT_FIELD_KEYS.filter(function (k) {
                return C.FOUR_S_DISABLED_USAGE_FIELDS.indexOf(k) === -1;
            });
        }
        return C.ALL_USAGE_LAYOUT_FIELD_KEYS.slice();
    }

    function usageFieldHasValue(report, key, C) {
        if (key.indexOf('ct_admittance_') === 0) {
            var ph = key.replace('ct_admittance_', '').replace(/_low|_high/, '');
            var avg = C.computeCtAdmittanceAvg
                ? C.computeCtAdmittanceAvg(report['ct_admittance_' + ph + '_low'], report['ct_admittance_' + ph + '_high'])
                : '';
            return !!str(avg);
        }
        return !!str(report[key]);
    }

    function hasCtRecords(report) {
        var cts = (report && report.cts) || [];
        return cts.some(function (ct) {
            return !!(str(ct.ratio_size) || str(ct.mfg) || str(ct.serial_number) || str(ct.accuracy_class));
        });
    }

    function hasPtRecords(report) {
        var pts = (report && report.pts) || [];
        if (pts.some(function (pt) {
            return !!(str(pt.ratio_size) || str(pt.mfg) || str(pt.serial_number));
        })) return true;
        return !!(str(report.pt_size));
    }

    function hasSocketData(report) {
        return !!(
            str(report.socket_manufacturer) || str(report.socket_location) || str(report.socket_bypass) ||
            str(report.socket_ground_impedance) || str(report.socket_ground_amps) ||
            str(report.potential_wire_a) || str(report.potential_wire_b) || str(report.potential_wire_c) ||
            str(report.current_wire_a) || str(report.current_wire_b) || str(report.current_wire_c)
        );
    }

    function hasTransformerData(report) {
        if (str(report.trans_type) || str(report.trans_centertapped) || str(report.trans_in_enclosure_or_ground) || str(report.trans_open_front)) {
            return true;
        }
        var trans = report.transformers || [];
        return trans.some(function (t) {
            return !!(str(t.size) || str(t.mfg) || str(t.serial_number) || str(t.primary_voltage));
        });
    }

    function hasBurdenTableData(report, C) {
        var ohms = C.BURDEN_OHMS_LIST || ['0.0', '0.1', '0.2', '0.5', '1.0', '2.0', '4.0'];
        var steps = C.PT_BURDEN_VA_LIST || ['0', '25', '50', '75', '100', '125', '150', '175'];
        var cts = report.cts || [];
        var pts = report.pts || [];
        var ctHit = cts.some(function (ct) {
            if (C.ensureCtBurdenGrid) C.ensureCtBurdenGrid(ct);
            return ohms.some(function (o) {
                var row = (ct.burden && ct.burden[o]) || {};
                return !!(str(row.pri) || str(row.sec) || str(row.drop));
            });
        });
        var ptHit = pts.some(function (pt) {
            return steps.some(function (va) {
                var row = (pt.va_burden && pt.va_burden[va]) || {};
                return !!(str(row.pri_v) || str(row.sec_v) || str(row.drop));
            });
        });
        return ctHit || ptHit;
    }

    function buildHero(report, C, meta) {
        var form = C.getReportForm(report);
        var listedMult = C.getListedMultiplier(report);
        var utilName = utilityDisplayName(state.utility);
        var utilAddr = utilityAddress(state.utility);
        var visitStamp = formatVisitDateTime(report);
        var savedNote = '';
        if (meta && meta.saved_at && window.WSAPP_VISUAL_BRIDGE) {
            savedNote = window.WSAPP_VISUAL_BRIDGE.formatSavedAt(meta.saved_at);
        }
        var locId = getLocationId(report);
        var memberName = getMemberCustomerName(report);
        var svcDesc = serviceDescPlain(report);
        var preparedFor = memberName
            ? 'Prepared by Watthour Solutions for ' + escapeHtml(memberName)
            : 'Prepared by Watthour Solutions';

        return '<div class="report-hero mb-6">' +
            '<div class="mb-3">' +
            '<div class="text-lg font-bold text-slate-900">' + escapeHtml(utilName) + '</div>' +
            (utilAddr ? '<div class="text-sm text-slate-600 mt-0.5">' + escapeHtml(utilAddr) + '</div>' : '') +
            '<div class="text-base font-semibold text-emerald-800 mt-2">Meter Test Report</div>' +
            '<p class="report-lede mt-2 mb-0">Summary for office staff and members — plain-language overview of what was tested at this site.</p>' +
            '</div>' +
            '<div class="report-summary-grid mb-3">' +
            summaryTile('Location ID', locId) +
            summaryTile('Member / Customer', memberName) +
            summaryTile('Meter number', report.meter_number, true) +
            summaryTile('Meter form', form) +
            summaryTile('Service description', svcDesc || '—') +
            summaryTile('Date & time', visitStamp || new Date().toLocaleDateString()) +
            '</div>' +
            '<div class="report-hero-meta flex flex-wrap gap-x-3 gap-y-1 items-center">' +
            '<span>Test reason: <strong>' + escapeHtml(testReasonPlain(report.test_reason)) + '</strong></span>' +
            '<span class="text-slate-300 hidden sm:inline">|</span>' +
            '<span>Nameplate multiplier: <strong>' + val(listedMult) + '</strong> ' + multiplierMatchInline(report.multiplier_match) + '</span>' +
            (savedNote ? '<span class="text-slate-300 hidden sm:inline">|</span><span class="text-sm text-slate-500">Data refreshed ' + escapeHtml(savedNote) + '</span>' : '') +
            '</div>' +
            '<div class="text-[10px] text-slate-400 mt-2">' + preparedFor + '</div>' +
            '</div>';
    }

    function kvRowHtml(label, valueHtml) {
        return '<dt>' + escapeHtml(label) + '</dt><dd>' + valueHtml + '</dd>';
    }

    function formatKhPkhDisplay(report, C) {
        var khRaw = str(report.kh);
        if (!khRaw) return '—';
        var kh = parseFloat(String(report.kh).replace(/,/g, ''));
        var mult = parseFloat(String(C.getListedMultiplier(report) || '').replace(/,/g, ''));
        if (!isFinite(kh) || !isFinite(mult)) return khRaw + ' / —';
        var pkh = kh * mult;
        var pkhStr = Math.abs(pkh - Math.round(pkh)) < 0.0005
            ? String(Math.round(pkh * 1000) / 1000)
            : pkh.toFixed(4).replace(/\.?0+$/, '');
        return khRaw + ' / ' + pkhStr;
    }

    function getTransformerConfigurationDisplay(report) {
        return str(report.transformer_configuration) || '—';
    }

    function buildAccountSectionBody(report, C) {
        var form = C.getReportForm(report);
        var rows = [
            kvRow('Location', getLocationId(report)),
            kvRow('Customer / member', getMemberCustomerName(report))
        ];
        if (str(report.account_number)) {
            rows.push(kvRow('Account number', report.account_number));
        }
        rows.push(
            kvRow('Address', report.address),
            kvRow('Meter ID', report.meter_number),
            kvRow('Meter form', form),
            kvRow('CT size', str(report.ct_size) || '—'),
            kvRow('PT size', str(report.pt_size) || '—'),
            kvRowHtml('KWh and KW multiplier', formatKwhKwMultiplierSummary(report, C) + ' ' + multiplierMatchInline(report.multiplier_match)),
            kvRow('Kh / PKh', formatKhPkhDisplay(report, C)),
            kvRow('Service voltage', report.meter_volt),
            kvRow('Service description', serviceDescPlain(report)),
            kvRow('Transformer configuration', getTransformerConfigurationDisplay(report))
        );
        return kvGrid(rows);
    }

    function buildMeterTestPills(report) {
        var skipped = !!str(report.meter_test_skip);
        var pills = '';
        METER_TEST_FIELDS.forEach(function (field) {
            var value = skipped ? '' : str(report[field.key]);
            var tier = skipped ? 'empty' : getMeterTestResultTier(value);
            var display = value || '-';
            var isPrimary = field.key === 'as_found_weighted_average';
            var cls = getMeterTestResultClass(tier);
            if (isPrimary) cls += ' report-meter-test-primary';
            var aria = field.label + ': ' + (display === '-' ? 'not recorded' : display + ' percent, ' + meterTestTierPlain(tier));
            pills += '<span class="report-meter-test-pill ' + cls + '" role="status" aria-label="' + escapeHtml(aria) + '">' +
                '<span class="lbl">' + escapeHtml(field.label) + (isPrimary ? ' ★' : '') + ':</span>' +
                '<span class="num">' + escapeHtml(display) + '</span></span>';
        });
        return '<div class="report-inline-pills" role="group" aria-label="Meter accuracy test results">' + pills + '</div>';
    }

    function buildMeterAccuracySectionBody(report, C) {
        report = normalizeReportForDisplay(report, C);
        var meter = C.computeMeterAccuracyBreakdown ? C.computeMeterAccuracyBreakdown(report) : null;
        var html = '<div class="report-panel">';
        if (!meter || meter.skipped) {
            html += '<p class="text-xs text-slate-500">Meter accuracy test was skipped.</p>';
        } else if (!meter.hasData) {
            html += '<p class="text-xs text-slate-500">No as-found meter test results recorded.</p>';
        } else {
            html += '<p class="text-xs text-slate-600 mb-2">Overall weighted average is the primary meter accuracy figure (★).</p>';
            html += buildMeterAccuracyPhaseTable(meter, C);
        }
        html += buildMeterTierLegend();
        html += '</div>';
        return html;
    }

    function buildCtAccuracyCompareSectionBody(report, C) {
        report = normalizeReportForDisplay(report, C);
        return '<div class="report-panel">' + buildCtAccuracyMethodsHtml(report, C) +
            '<div class="report-tier-legend text-xs text-slate-600 mt-2" role="note">' +
            '<strong>CT/PT color guide:</strong> green ≤2% error · yellow 2–4% · red &gt;4% from 100% accurate.</div></div>';
    }

    function buildPtAccuracyCompareSectionBody(report, C) {
        report = normalizeReportForDisplay(report, C);
        return '<div class="report-panel">' + buildPtAccuracyMethodsHtml(report, C) + '</div>';
    }

    function buildRegistrationImpactSectionBody(report, C) {
        report = normalizeReportForDisplay(report, C);
        if (!C.computeRegistrationImpact || !C.renderRegistrationImpactHtml) {
            return '<p class="report-empty">Registration impact not available.</p>';
        }
        var impact = C.computeRegistrationImpact(report);
        if (!impact || !impact.showImpact) {
            return '<p class="report-empty">No registration impact data for this test.</p>';
        }
        return '<div class="report-panel">' +
            C.renderRegistrationImpactHtml(impact, { valueClassPrefix: 'report-meter-test-' }) + '</div>';
    }

    function buildVectorDiagramSectionBody(report, C, B) {
        var chartBundle = window.WSAPP_CHART_BUNDLE;
        if (!chartBundle || !chartBundle.buildVectorChartVisual) {
            return '<p class="text-xs text-slate-500">Chart bundle not loaded.</p>';
        }
        if (!C.supportsVectorDiagram || !C.supportsVectorDiagram(report)) {
            return noDataChartPlaceholder('Vector diagram not available for this meter form or phase.');
        }
        return chartBundle.buildVectorChartVisual(report, C, { idPrefix: 'test-report-vector', B: B });
    }

    function buildAccuracySection(report, C, opts) {
        opts = opts || {};
        report = normalizeReportForDisplay(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var ctCount = C.getCtCountForForm ? C.getCtCountForForm(form) : 0;
        var html = buildMeterAccuracySectionBody(report, C);
        if (!selfContained && ctCount > 0) {
            html += buildCtAccuracyCompareSectionBody(report, C);
        }
        if (!selfContained && hasPtRecords(report)) {
            html += buildPtAccuracyCompareSectionBody(report, C);
        }
        if (C.computeRegistrationImpact) {
            var impact = C.computeRegistrationImpact(report);
            if (impact && impact.showImpact) {
                html += buildRegistrationImpactSectionBody(report, C);
            }
        }
        return html;
    }

    function appendAccuracyReportSections(report, C, B, html, navItems) {
        report = normalizeReportForDisplay(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var ctCount = C.getCtCountForForm ? C.getCtCountForForm(form) : 0;
        var d = computeSummaryData(report, C);
        var chartBundle = window.WSAPP_CHART_BUNDLE;

        navItems.push({ id: 'section-service-accuracy', label: 'Service accuracy' });
        html += collapsibleSection('Overall Service Accuracy', buildSummaryServiceAccuracyFooter(d, C, report),
            'section-service-accuracy', { defaultOpen: true });

        navItems.push({ id: 'section-meter-accuracy', label: 'Meter accuracy' });
        html += collapsibleSection('Meter Accuracy', buildMeterAccuracySectionBody(report, C), 'section-meter-accuracy');

        if (!selfContained && ctCount > 0) {
            navItems.push({ id: 'section-ct-accuracy', label: 'CT accuracy' });
            html += collapsibleSection('CT Accuracy — Compare Methods', buildCtAccuracyCompareSectionBody(report, C),
                'section-ct-accuracy');
        }

        if (!selfContained && hasPtRecords(report)) {
            navItems.push({ id: 'section-pt-accuracy', label: 'PT accuracy' });
            html += collapsibleSection('PT / VT Accuracy — Compare Methods', buildPtAccuracyCompareSectionBody(report, C),
                'section-pt-accuracy');
        }

        if (C.computeRegistrationImpact) {
            var impact = C.computeRegistrationImpact(report);
            if (impact && impact.showImpact) {
                navItems.push({ id: 'section-registration', label: 'Registration' });
                html += collapsibleSection('Registration Impact', buildRegistrationImpactSectionBody(report, C),
                    'section-registration');
            }
        }

        if (chartBundle && chartBundle.buildVectorChartVisual && C.supportsVectorDiagram && C.supportsVectorDiagram(report)) {
            navItems.push({ id: 'section-vector', label: 'Vector' });
            html += collapsibleSection('Vector Diagram', buildVectorDiagramSectionBody(report, C, B), 'section-vector');
        }

        return html;
    }

    function buildSummaryServiceAccuracyFooter(d, C, report) {
        var html = '<div class="report-service-accuracy-final" role="status" aria-label="Overall Service Accuracy">';
        html += '<div class="report-service-accuracy-final-label">Overall Service Accuracy</div>';
        html += '<div class="report-service-accuracy-final-value">' + escapeHtml(d.serviceAccuracy) + '</div>';
        if (d.registrationLoss) {
            html += '<div class="report-service-accuracy-final-sub">Est. under-registration (amps-weighted): ' +
                escapeHtml(d.registrationLoss) + '</div>';
        }
        html += '</div>';
        return html;
    }

    function buildMeterSectionBody(report, C) {
        var skipped = !!str(report.meter_test_skip);
        var timedKw = C.formatTimedRevKwDisplay
            ? C.formatTimedRevKwDisplay(C.computeTimedRevKwSimple(report.as_found_timed_revolutions, report))
            : '—';
        var testVoltsAmps = [str(report.test_volts), str(report.testing_amps) ? str(report.testing_amps) + ' A' : ''].filter(Boolean).join(' @ ') || '';
        var registerLine = REGISTER_READING_FIELDS.map(function (f) {
            return formatRegisterReading(f.label, report[f.key]);
        }).join(', ');

        var rows = [
            kvRow('Meter Mfg', report.meter_mfg),
            kvRow('Meter Type', report.meter_type),
            kvRow('Class', report.meter_class),
            kvRow('Kt', report.kt),
            kvRow('Test Voltage & Amps', testVoltsAmps),
            kvRow('Display problem noted?', report.meter_bad_display === 'YES' ? 'Yes' : 'No'),
            kvRow('Register readings', registerLine),
            kvRow('KW (based on time check)', timedKw),
            kvRowHtml('As-found meter test results', buildMeterTestPills(report)),
            kvRow('Meter test skipped?', skipped ? 'Yes' : 'No')
        ];
        return kvGrid(rows);
    }

    function buildSocketSectionBody(report) {
        var potColors = formatPipeValues([report.potential_wire_a, report.potential_wire_b, report.potential_wire_c]);
        var curColors = formatPipeValues([report.current_wire_a, report.current_wire_b, report.current_wire_c]);
        var groundParts = [];
        if (str(report.socket_ground_impedance)) groundParts.push(str(report.socket_ground_impedance) + ' Ω');
        if (str(report.socket_ground_amps)) groundParts.push(str(report.socket_ground_amps) + ' A');
        if (str(report.socket_ground_status) && !groundParts.length) groundParts.push(str(report.socket_ground_status));
        var groundLine = groundParts.length ? groundParts.join(' | ') : '—';

        return kvGrid([
            kvRow('Socket manufacturer', report.socket_manufacturer),
            kvRow('Socket location', report.socket_location),
            kvRow('Socket bypass', report.socket_bypass),
            kvRow('Potential wire colors (A | B | C)', potColors),
            kvRow('Current wire colors (A | B | C)', curColors),
            kvRow('Ground impedance / ground current', groundLine)
        ]);
    }

    function buildTransformerPipeRow(label, transList, pick) {
        var values = transList.map(function (t) { return pick(t); });
        if (!values.some(str)) return '';
        return kvRow(label, formatPipeValues(values));
    }

    function buildTransformerBlock(report, C) {
        if (C.isPrimaryServiceTransType && C.isPrimaryServiceTransType(report)) {
            return kvGrid([
                kvRow('Total size (kVA)', '—'),
                kvRow('Transformer type', report.trans_type || 'Primary Service')
            ]);
        }
        var trans = getActiveTransformers(report);
        if (!trans.length) {
            return '<p class="text-xs text-slate-500">No transformer data recorded.</p>';
        }
        var totalKva = C.computeTotalTransformerKva ? C.computeTotalTransformerKva(report) : '';
        var rows = [
            kvRow('Total size (kVA)', totalKva || '—'),
            kvRow('Transformer type', report.trans_type),
            kvRow('Center-tapped', report.trans_centertapped),
            kvRow('In enclosure / on ground', report.trans_in_enclosure_or_ground),
            kvRow('Open-front accessible', report.trans_open_front)
        ];
        var pipeRows = [
            buildTransformerPipeRow('Size (kVA)', trans, function (t) { return t.size; }),
            buildTransformerPipeRow('Manufacturer', trans, function (t) { return t.mfg; }),
            buildTransformerPipeRow('Serial number', trans, function (t) { return t.serial_number; }),
            buildTransformerPipeRow('Mfg year', trans, function (t) { return t.mfg_year; }),
            buildTransformerPipeRow('Primary voltage', trans, function (t) { return t.primary_voltage; }),
            buildTransformerPipeRow('Secondary voltage', trans, function (t) { return t.secondary_voltage; }),
            buildTransformerPipeRow('Impedance', trans, function (t) { return t.impedance; })
        ].filter(Boolean);
        return '<dl class="report-kv-3col">' + rows.map(function (r) { return r; }).join('') + pipeRows.join('') + '</dl>';
    }

    function buildCtRows(report) {
        var cts = (report && report.cts) || [];
        if (!cts.length) return '';
        return cts.map(function (ct, i) {
            var title = 'Current transformer (CT) #' + (ct.ct_number || (i + 1));
            if (ct.burden_phase) title += ' — ' + ct.burden_phase + ' phase';
            return '<div class="report-panel mb-3">' +
                '<div class="text-xs font-bold text-slate-700 mb-2">' + escapeHtml(title) + '</div>' +
                kvGrid([
                    kvRow('Ratio (e.g. 200:5)', ct.ratio_size ? ct.ratio_size + (String(ct.ratio_size).indexOf(':') === -1 ? ':5' : '') : ct.ratio_size),
                    kvRow('Manufacturer', ct.mfg),
                    kvRow('Serial number', ct.serial_number),
                    kvRow('Accuracy class', ct.accuracy_class),
                    kvRow('Burden rating', ct.burden_rating),
                    kvRow('Double pass', ct.double_pass),
                    kvRow('Primary turns', ct.primary_turns),
                    kvRow('Physical position', ct.position_location)
                ]) + '</div>';
        }).join('');
    }

    function buildPtRows(report) {
        var pts = (report && report.pts) || [];
        if (!pts.length) return '';
        return pts.map(function (pt, i) {
            return '<div class="report-panel mb-3">' +
                '<div class="text-xs font-bold text-slate-700 mb-2">Potential transformer (PT/VT) #' + (pt.pt_number || (i + 1)) + '</div>' +
                kvGrid([
                    kvRow('Ratio', pt.ratio_size),
                    kvRow('Manufacturer', pt.mfg),
                    kvRow('Serial number', pt.serial_number),
                    kvRow('Accuracy class', pt.accuracy_class),
                    kvRow('Burden rating (VA)', pt.burden_rating),
                    kvRow('Position', pt.position_location)
                ]) + '</div>';
        }).join('');
    }

    function buildUsageBlock(report, C) {
        var enabled = getEnabledUsageFieldKeys(report, C) || [];
        var pf = C.getCalculatedPowerFactors(report);
        var rows = [];
        var groups = {
            volts: [],
            thd: [],
            amps: [],
            angles: [],
            other: []
        };

        enabled.forEach(function (key) {
            if (!usageFieldHasValue(report, key, C)) return;
            var label = USAGE_FIELD_LABELS[key] || key.replace(/_/g, ' ');
            var value = report[key];
            if (key.indexOf('phase_angle_') === 0) groups.angles.push(kvRow(label, value));
            else if (key.indexOf('voltage_thd_') === 0) groups.thd.push(kvRow(label, value));
            else if (key.indexOf('_amps_') !== -1) groups.amps.push(kvRow(label, value));
            else if (key.indexOf('_volts_') !== -1) groups.volts.push(kvRow(label, value));
            else groups.other.push(kvRow(label, value));
        });

        ['a', 'b', 'c'].forEach(function (ph) {
            var lowKey = 'ct_admittance_' + ph + '_low';
            if (enabled.indexOf(lowKey) === -1) return;
            var avg = C.computeCtAdmittanceAvg
                ? C.computeCtAdmittanceAvg(report[lowKey], report['ct_admittance_' + ph + '_high'])
                : '';
            if (str(avg)) {
                groups.other.push(kvRow('CT admittance average — Phase ' + ph.toUpperCase(), avg));
            }
        });

        function appendGroup(title, items) {
            if (!items.length) return;
            rows.push('<div class="report-subsection"><div class="report-subsection-title">' + escapeHtml(title) + '</div>' + kvGrid(items) + '</div>');
        }

        appendGroup('Voltages at the meter and line', groups.volts);
        appendGroup('Harmonic distortion (THD)', groups.thd);
        appendGroup('Current measurements', groups.amps);
        appendGroup('Phase angles', groups.angles);
        appendGroup('Other measurements', groups.other);

        var pfBlock = '<div class="report-subsection"><div class="report-subsection-title">Calculated power factor</div>' +
            '<p class="report-lede mb-2">Derived from phase-angle readings — indicates how efficiently the load uses power (1.0 is ideal).</p>' +
            kvGrid([
                kvRow('Average PF', formatPf(pf.average)),
                kvRow('Phase A PF', formatPf(pf.a)),
                kvRow('Phase B PF', formatPf(pf.b)),
                kvRow('Phase C PF', formatPf(pf.c))
            ]) + '</div>';

        if (!rows.length && pf.average == null) {
            return '<p class="text-xs text-slate-500">No usage measurements were recorded for this meter form.</p>';
        }
        return rows.join('') + pfBlock;
    }

    function buildCtBurdenTables(report, C) {
        var ohms = C.BURDEN_OHMS_LIST || ['0.0', '0.1', '0.2', '0.5', '1.0', '2.0', '4.0'];
        var cts = (report && report.cts) || [];
        if (!cts.length) return '';

        return cts.map(function (ct, idx) {
            if (C.ensureCtBurdenGrid) C.ensureCtBurdenGrid(ct);
            var rows = '';
            ohms.forEach(function (o) {
                var row = (ct.burden && ct.burden[o]) || {};
                if (!str(row.pri) && !str(row.sec) && !str(row.drop)) return;
                rows += '<tr class="border-t border-slate-100">' +
                    '<td class="px-2 py-1 font-mono text-[11px]">' + escapeHtml(o) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.pri) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.sec) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.drop) + '</td>' +
                    '</tr>';
            });
            if (!rows) return '';
            return '<div class="mb-4"><div class="text-xs font-semibold text-slate-700 mb-1">CT #' + (ct.ct_number || (idx + 1)) +
                (ct.burden_phase ? ' · ' + escapeHtml(ct.burden_phase) + ' phase' : '') + '</div>' +
                '<p class="text-[10px] text-slate-500 mb-1">Burden ohms vs primary/secondary current and percent drop</p>' +
                '<table class="w-full text-left border border-slate-200 rounded-lg overflow-hidden"><thead class="bg-slate-100 text-[10px] uppercase text-slate-500">' +
                '<tr><th class="px-2 py-1">Ω</th><th class="px-2 py-1">Primary I</th><th class="px-2 py-1">Secondary I</th><th class="px-2 py-1">% Drop</th></tr></thead><tbody>' +
                rows + '</tbody></table></div>';
        }).join('');
    }

    function buildPtBurdenTables(report, C) {
        var steps = C.PT_BURDEN_VA_LIST || ['0', '25', '50', '75', '100', '125', '150', '175'];
        var pts = (report && report.pts) || [];
        if (!pts.length) return '';

        return pts.map(function (pt, idx) {
            var rows = '';
            steps.forEach(function (va) {
                var row = (pt.va_burden && pt.va_burden[va]) || {};
                if (!str(row.pri_v) && !str(row.sec_v) && !str(row.drop)) return;
                rows += '<tr class="border-t border-slate-100">' +
                    '<td class="px-2 py-1 font-mono text-[11px]">' + escapeHtml(va) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.pri_v) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.sec_v) + '</td>' +
                    '<td class="px-2 py-1 text-[11px]">' + val(row.drop) + '</td>' +
                    '</tr>';
            });
            if (!rows) return '';
            return '<div class="mb-4"><div class="text-xs font-semibold text-slate-700 mb-1">PT/VT #' + (pt.pt_number || (idx + 1)) +
                (pt.va_burden_phase ? ' · ' + escapeHtml(pt.va_burden_phase) + ' phase' : '') + '</div>' +
                '<table class="w-full text-left border border-slate-200 rounded-lg overflow-hidden"><thead class="bg-slate-100 text-[10px] uppercase text-slate-500">' +
                '<tr><th class="px-2 py-1">VA</th><th class="px-2 py-1">Primary V</th><th class="px-2 py-1">Secondary V</th><th class="px-2 py-1">% Drop</th></tr></thead><tbody>' +
                rows + '</tbody></table></div>';
        }).join('');
    }

    function buildTransformerSectionBody(report, C) {
        if (!hasTransformerData(report) && !(C.isPrimaryServiceTransType && C.isPrimaryServiceTransType(report))) {
            return '<p class="report-empty">No transformer data recorded.</p>';
        }
        return buildTransformerBlock(report, C);
    }

    function buildCtDataSectionBody(report, C) {
        var form = C.getReportForm(report);
        if (C.isSelfContainedMeterForm(form)) {
            return '<p class="report-empty">Not applicable for this meter form.</p>';
        }
        var body = buildCtRows(report);
        return body || '<p class="report-empty">No CT records for this test.</p>';
    }

    function buildPtDataSectionBody(report, C) {
        var form = C.getReportForm(report);
        if (C.isSelfContainedMeterForm(form)) {
            return '<p class="report-empty">Not applicable for this meter form.</p>';
        }
        var body = buildPtRows(report);
        if (!body && str(report.pt_size)) {
            return kvGrid([kvRow('PT size (account)', report.pt_size)]);
        }
        return body || '<p class="report-empty">No PT/VT records for this test.</p>';
    }

    function buildCtBurdenChartsSectionBody(report, C, B) {
        var chartBundle = window.WSAPP_CHART_BUNDLE;
        if (!chartBundle || !chartBundle.buildCtBurdenChartVisuals) {
            return '<p class="text-xs text-slate-500">Chart bundle not loaded.</p>';
        }
        return chartBundle.buildCtBurdenChartVisuals(report, C, B, { idPrefix: 'test-report-ct' });
    }

    function buildPtBurdenChartsSectionBody(report, C, B) {
        var chartBundle = window.WSAPP_CHART_BUNDLE;
        if (!chartBundle || !chartBundle.buildPtBurdenChartVisuals) {
            return '<p class="text-xs text-slate-500">Chart bundle not loaded.</p>';
        }
        return chartBundle.buildPtBurdenChartVisuals(report, C, B, { idPrefix: 'test-report-pt' });
    }

    function buildConsolidatedNotesSectionBody(report) {
        var allHigh = getReportNoteLines(report, 'high');
        var allInfo = getReportNoteLines(report, 'info');
        var meterMatchers = METER_NOTE_MATCHERS;
        var socketMatchers = SOCKET_NOTE_MATCHERS;
        var html = '';

        if (allHigh.length) {
            html += '<div class="summary-notes-panel report-notes-subsection">' +
                '<h4 class="report-subsection-title">High-priority notes</h4>' +
                buildSummaryHighNotesBlock(allHigh) + '</div>';
        }

        function infoNotesForMatchers(matchers) {
            return allInfo.filter(function (line) { return lineMatchesAny(line, matchers); });
        }

        function infoNotesExcludingMatcherLists(matcherLists) {
            return allInfo.filter(function (line) {
                return !matcherLists.some(function (matchers) { return lineMatchesAny(line, matchers); });
            });
        }

        var meterInfo = infoNotesForMatchers(meterMatchers);
        var socketInfo = infoNotesForMatchers(socketMatchers);
        var generalInfo = infoNotesExcludingMatcherLists([meterMatchers, socketMatchers]);

        function appendInfoSubsection(title, lines) {
            if (!lines.length) return;
            html += '<div class="report-notes-subsection"><h4 class="report-subsection-title">' + escapeHtml(title) + '</h4>';
            lines.forEach(function (line) {
                html += '<div class="report-note-info">' + escapeHtml(line) + '</div>';
            });
            html += '</div>';
        }

        appendInfoSubsection('Meter & test notes', meterInfo);
        appendInfoSubsection('Socket & wiring notes', socketInfo);
        appendInfoSubsection('General informational notes', generalInfo);

        if (!html) {
            html = '<p class="report-empty">No field notes recorded for this visit.</p>';
        }
        return html;
    }

    function buildChartsDocumentHtml(report, C, B) {
        var bundle = window.WSAPP_CHART_BUNDLE;
        if (!bundle || !bundle.buildChartsDocumentHtml) {
            return '<div class="report-document-charts" id="report-document-charts"><p class="text-red-600 text-sm">Chart bundle not loaded.</p></div>';
        }
        return bundle.buildChartsDocumentHtml(report, C, B, {
            normalizeReportForDisplay: normalizeReportForDisplay,
            buildReportFooter: buildReportFooter,
            meta: state.meta
        });
    }

    function buildFullReportHtml(report, C, B, meta) {
        report = normalizeReportForDisplay(report, C);
        var form = C.getReportForm(report);
        var selfContained = C.isSelfContainedMeterForm(form);
        var ctCount = C.getCtCountForForm ? C.getCtCountForForm(form) : 0;
        var utilName = utilityDisplayName(state.utility);
        var utilAddr = utilityAddress(state.utility);
        var navItems = [];
        var html = '<div class="report-document-full" id="report-document-full">';
        html += buildSummaryLetterheadHtml(utilName, utilAddr, getLocationId(report), getMemberCustomerName(report));
        html += '<div class="report-full-intro">' +
            '<h2 class="report-heading-doc report-full-title">Full Test Report</h2>' +
            '<p class="report-full-subtitle">Field test report for ' + escapeHtml(getLocationId(report) || 'this site') +
            ' — use section links below to jump, or tap a section heading to expand or collapse.</p>' +
            '</div>';
        html += '<!--REPORT_NAV-->';

        navItems.push({ id: 'section-account', label: 'Account' });
        html += collapsibleSection('Account Summary', buildAccountSectionBody(report, C), 'section-account', { defaultOpen: true });

        html = appendAccuracyReportSections(report, C, B, html, navItems);

        navItems.push({ id: 'section-meter', label: 'Meter' });
        html += collapsibleSection('Meter Test Data', buildMeterSectionBody(report, C), 'section-meter');

        navItems.push({ id: 'section-socket', label: 'Socket' });
        html += collapsibleSection('Socket & Wiring', buildSocketSectionBody(report), 'section-socket');

        navItems.push({ id: 'section-transformer', label: 'Transformer' });
        html += collapsibleSection('Transformer Data', buildTransformerSectionBody(report, C), 'section-transformer');

        if (!selfContained && ctCount > 0) {
            navItems.push({ id: 'section-ct', label: 'CT' });
            html += collapsibleSection('CT Data', buildCtDataSectionBody(report, C), 'section-ct');
        }

        if (!selfContained && (hasPtRecords(report) || str(report.pt_size))) {
            navItems.push({ id: 'section-pt', label: 'PT' });
            html += collapsibleSection('PT / VT Data', buildPtDataSectionBody(report, C), 'section-pt');
        }

        navItems.push({ id: 'section-usage', label: 'Usage' });
        html += collapsibleSection('Usage Measurements', buildUsageBlock(report, C), 'section-usage');

        if (!selfContained && ctCount > 0) {
            navItems.push({ id: 'section-ct-charts', label: 'CT charts' });
            html += collapsibleSection('CT Burden Graphs', buildCtBurdenChartsSectionBody(report, C, B), 'section-ct-charts');
        }

        if (!selfContained && hasPtRecords(report)) {
            navItems.push({ id: 'section-pt-charts', label: 'PT charts' });
            html += collapsibleSection('PT / VT Burden Graphs', buildPtBurdenChartsSectionBody(report, C, B), 'section-pt-charts');
        }

        navItems.push({ id: 'section-notes', label: 'Notes' });
        html += collapsibleSection('Field Notes', buildConsolidatedNotesSectionBody(report), 'section-notes');

        html += buildReportFooter(meta, report);
        html += '</div>';

        return { html: html, navItems: navItems };
    }

    function buildReportHtml(report, C, B, meta, view) {
        view = view || 'all';
        if (view === 'summary') {
            return { html: buildSummarySection(report, C), navItems: [{ id: 'section-summary', label: 'Summary' }] };
        }
        if (view === 'full') {
            var fullOnly = buildFullReportHtml(report, C, B, meta);
            fullOnly.navItems = fullOnly.navItems.filter(function (n) { return n.id !== 'section-summary'; });
            return fullOnly;
        }
        if (view === 'charts') {
            return { html: buildChartsDocumentHtml(report, C, B), navItems: [{ id: 'report-document-charts', label: 'Charts' }] };
        }
        var summaryHtml = buildSummarySection(report, C);
        var full = buildFullReportHtml(report, C, B, meta);
        var html = summaryHtml + '<!--REPORT_NAV-->' + full.html;
        return { html: html, navItems: full.navItems };
    }

    function buildSummaryShareText(report, C) {
        var d = computeSummaryData(report, C);
        var whs = WATTHOUR_BUSINESS;
        var lines = [
            utilityDisplayName(state.utility),
            utilityAddress(state.utility),
            '',
            whs.name,
            whs.address + ', ' + whs.city + ', ' + whs.state + ' ' + whs.zip,
            '',
            'METER TEST SUMMARY',
            'Location ID: ' + (d.locationId || '—'),
            'Member / Customer: ' + (d.memberName || '—'),
            'Test Date: ' + d.testDate,
            'Test Time: ' + d.testTime,
            'Service Description: ' + (d.serviceDescription || '—'),
            'Meter ID: ' + (d.meterNumber || '—'),
            'KWh and KW Multiplier: ' + (d.multiplierKwhKw.replace(/<[^>]+>/g, '') || '—'),
            'Meter Form: ' + d.meterForm,
            'Meter KWh (at test): ' + d.meterKwh,
            'Meter KW (at test): ' + d.meterKw,
            'Meter Weighted Accuracy: ' + d.meterWeightedAccuracy,
            (d.showPrimaryVolts ? 'Primary Voltages: ' + d.primaryVolts : ''),
            'Secondary Voltages: ' + d.secondaryVolts,
            'Primary Current (@ 0 burden): ' + d.primaryCurrentZeroBurden,
            'Secondary Current (@ 0 burden): ' + d.secondaryCurrentZeroBurden,
            'CT Ratio: ' + d.ctRatio,
            'CT Overall Accuracy: ' + d.ctAccuracy,
            (d.hasPt ? 'PT Ratio: ' + d.ptRatio : ''),
            (d.hasPt ? 'PT Overall Accuracy: ' + d.ptAccuracy : ''),
            'Measured PF: ' + d.powerFactor,
            'Avg Voltage THD | Current THD: ' + d.thdCombined,
            'Transformer KVA (T1|T2|T3|Ttotal): ' + d.transformerKvaPipe,
            'Overall Service Accuracy: ' + d.serviceAccuracy
        ];
        lines.push('', 'High-priority notes:');
        if (d.highNotes.length) {
            d.highNotes.forEach(function (n) { lines.push('! ' + n); });
        } else {
            lines.push('None');
        }
        if (d.infoNotes.length) {
            lines.push('', 'Informational notes:');
            d.infoNotes.forEach(function (n) { lines.push('• ' + n); });
        }
        lines.push('', 'Prepared by Watthour Solutions');
        return lines.filter(Boolean).join('\n');
    }

    function buildFullShareText(report, C) {
        return buildSummaryShareText(report, C) + '\n\n---\n\nFull technical report available in WSApp Test Report.';
    }

    function buildBothShareText(report, C) {
        return buildSummaryShareText(report, C);
    }

    function getReportSnapshotCss() {
        var styleEl = document.querySelector('style');
        return styleEl ? styleEl.textContent : '';
    }

    function getDocumentInnerHtml(target) {
        var summary = document.getElementById('section-summary');
        var full = document.getElementById('report-document-full');
        var charts = document.getElementById('report-document-charts');
        if (target === 'summary') return summary ? summary.outerHTML : '';
        if (target === 'full') return full ? full.outerHTML : '';
        if (target === 'charts') return charts ? charts.outerHTML : '';
        var parts = [];
        if (summary) parts.push(summary.outerHTML);
        if (full) parts.push(full.outerHTML);
        return parts.join('\n');
    }

    function getActiveDocumentTarget() {
        var view = state.view || getReportView();
        if (view === 'summary' || view === 'full' || view === 'charts') return view;
        return 'both';
    }

    function buildSnapshotFilename(suffix, ext) {
        var loc = String(getLocationId(state.report) || 'site').replace(/[^\w\-]+/g, '_');
        var meter = String(state.report.meter_number || '').replace(/[^\w\-]+/g, '_');
        var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        var util = String(utilityDisplayName(state.utility)).replace(/[^\w\-]+/g, '_');
        return 'meter_test_' + suffix + '_' + util + '_' + loc + (meter ? '_' + meter : '') + '_' + stamp + '.' + (ext || 'pdf');
    }

    function buildPdfFilename(target) {
        return buildSnapshotFilename(target, 'pdf');
    }

    var PDF_UTILITY_CSS = [
        '.text-slate-400{color:#94a3b8}.text-slate-500{color:#64748b}.text-slate-600{color:#475569}',
        '.text-slate-800{color:#1e293b}.text-xs{font-size:.75rem;line-height:1rem}',
        '.text-sm{font-size:.875rem;line-height:1.25rem}.text-center{text-align:center}',
        '.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.p-2{padding:.5rem}.p-8{padding:2rem}',
        '.bg-slate-50{background:#f8fafc}.rounded-xl{border-radius:.75rem}',
        '.border{border-width:1px;border-style:solid}.border-slate-200{border-color:#e2e8f0}',
        '.border-slate-300{border-color:#cbd5e1}.border-dashed{border-style:dashed}',
        '.border-red-100{border-color:#fee2e2}.border-blue-100{border-color:#dbeafe}',
        '.pdf-capture-content img{max-width:100%;height:auto}'
    ].join('');

    function html2pdfAvailable() {
        return typeof window.html2pdf === 'function';
    }

    function getPrintableRootElement(target) {
        if (target === 'summary') return document.getElementById('section-summary');
        if (target === 'full') return document.getElementById('report-document-full');
        if (target === 'charts') return document.getElementById('report-document-charts');
        return document.getElementById('test-report-host');
    }

    function clearPrintFocusMarkers() {
        document.querySelectorAll('.print-focus').forEach(function (el) {
            el.classList.remove('print-focus');
        });
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
        clearPrintFocusMarkers();
    }

    function printSection(sectionId) {
        var el = document.getElementById(sectionId);
        if (!el) {
            showReportToast('Section not found.', 'error');
            return;
        }
        clearPrintFocusMarkers();
        el.classList.add('print-focus');
        var origTitle = document.title;
        document.title = '\u00a0';
        setPrintTargetClass('section:' + sectionId);
        try { window.focus(); } catch (e) { /* ignore */ }
        showReportToast('Printing this section — choose Save as PDF in the dialog.', 'ok');
        window.print();
        setTimeout(function () {
            document.title = origTitle;
            clearPrintTargetClass();
        }, 500);
    }

    function destroyPdfCaptureRoot() {
        var root = document.getElementById('wsapp-pdf-capture-root');
        if (root && root.parentNode) root.parentNode.removeChild(root);
    }

    function buildPdfCaptureRoot(target) {
        var inner = getDocumentInnerHtml(target);
        if (!inner) return null;
        destroyPdfCaptureRoot();
        var root = document.createElement('div');
        root.id = 'wsapp-pdf-capture-root';
        root.setAttribute('aria-hidden', 'true');
        root.style.cssText = 'position:fixed;left:0;top:0;width:760px;max-width:760px;background:#fff;color:#1e293b;z-index:-1;opacity:0.01;pointer-events:none;padding:16px 20px;box-sizing:border-box;overflow:visible;';
        var style = document.createElement('style');
        style.textContent = getReportSnapshotCss() + PDF_UTILITY_CSS;
        root.appendChild(style);
        var content = document.createElement('div');
        content.className = 'pdf-capture-content' + (target === 'summary' ? ' summary-one-page' : '');
        content.innerHTML = inner;
        root.appendChild(content);
        document.body.appendChild(root);
        return content;
    }

    function measureCaptureHeight(el) {
        return Math.max(
            el.scrollHeight || 0,
            el.offsetHeight || 0,
            el.getBoundingClientRect().height || 0
        );
    }

    function applySummaryPdfScaleIfNeeded(captureEl, target) {
        if (target !== 'summary') return;
        var LETTER_CONTENT_PX = 1000;
        var h = measureCaptureHeight(captureEl);
        if (h <= LETTER_CONTENT_PX) return;
        var scale = LETTER_CONTENT_PX / h;
        if (scale < 0.72) scale = 0.72;
        captureEl.style.transform = 'scale(' + scale.toFixed(4) + ')';
        captureEl.style.transformOrigin = 'top left';
        captureEl.parentElement.style.height = Math.ceil(h * scale) + 'px';
        captureEl.parentElement.style.width = Math.ceil((captureEl.scrollWidth || 760) * scale) + 'px';
    }

    function waitForPdfImage(img) {
        return new Promise(function (resolve) {
            if (!img || !img.src) {
                resolve();
                return;
            }
            if (img.complete && img.naturalWidth) {
                resolve();
                return;
            }
            var done = false;
            function finish() {
                if (done) return;
                done = true;
                resolve();
            }
            img.onload = finish;
            img.onerror = function () {
                img.style.display = 'none';
                finish();
            };
            setTimeout(finish, 5000);
        });
    }

    function inlinePdfImage(img) {
        return waitForPdfImage(img).then(function () {
            if (!img || img.style.display === 'none' || !img.naturalWidth) return;
            try {
                var canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                img.src = canvas.toDataURL('image/png');
            } catch (e) {
                img.style.display = 'none';
            }
        });
    }

    function rasterizePdfSvgs(root) {
        var svgs = root.querySelectorAll('svg');
        if (!svgs.length) return Promise.resolve();
        return Promise.all(Array.prototype.map.call(svgs, function (svg) {
            return new Promise(function (resolve) {
                try {
                    var rect = svg.getBoundingClientRect();
                    var w = Math.max(1, Math.round(svg.width && svg.width.baseVal ? svg.width.baseVal.value : rect.width || 520));
                    var h = Math.max(1, Math.round(svg.height && svg.height.baseVal ? svg.height.baseVal.value : rect.height || 300));
                    var xml = new XMLSerializer().serializeToString(svg);
                    var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
                    var url = URL.createObjectURL(blob);
                    var image = new Image();
                    image.onload = function () {
                        try {
                            var canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            var ctx = canvas.getContext('2d');
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, w, h);
                            ctx.drawImage(image, 0, 0, w, h);
                            var replacement = document.createElement('img');
                            replacement.src = canvas.toDataURL('image/png');
                            replacement.alt = svg.getAttribute('aria-label') || 'Chart';
                            replacement.style.maxWidth = '100%';
                            replacement.style.height = 'auto';
                            if (svg.parentNode) svg.parentNode.replaceChild(replacement, svg);
                        } catch (e) { /* keep svg */ }
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    image.onerror = function () {
                        URL.revokeObjectURL(url);
                        resolve();
                    };
                    image.src = url;
                } catch (e) {
                    resolve();
                }
            });
        }));
    }

    function preparePdfCaptureRoot(root) {
        var imgs = root.querySelectorAll('img');
        return Promise.all(Array.prototype.map.call(imgs, inlinePdfImage)).then(function () {
            return rasterizePdfSvgs(root);
        });
    }

    function runHtml2PdfOnElement(el, target) {
        var width = Math.max(320, el.scrollWidth || el.offsetWidth || 760);
        var height = measureCaptureHeight(el);
        var opt = {
            margin: target === 'summary' ? [4, 5, 4, 5] : [6, 6, 6, 6],
            filename: buildPdfFilename(target),
            image: { type: 'jpeg', quality: 0.94 },
            html2canvas: {
                scale: target === 'summary' ? 2 : 1.5,
                useCORS: false,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: width,
                height: height,
                windowWidth: width,
                windowHeight: height,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: target === 'summary' ? ['avoid-all'] : ['css', 'legacy'] }
        };
        return window.html2pdf().set(opt).from(el).outputPdf('blob').catch(function () {
            return window.html2pdf().set(opt).from(el).output('blob');
        });
    }

    function generatePdfBlob(target) {
        if (!html2pdfAvailable()) return Promise.reject(new Error('html2pdf not loaded'));
        if (!getDocumentInnerHtml(target)) return Promise.reject(new Error('nothing to export'));
        var captureEl = buildPdfCaptureRoot(target);
        if (!captureEl) return Promise.reject(new Error('capture root failed'));
        return preparePdfCaptureRoot(captureEl).then(function () {
            applySummaryPdfScaleIfNeeded(captureEl, target);
            return runHtml2PdfOnElement(captureEl, target);
        }).then(function (blob) {
            destroyPdfCaptureRoot();
            if (!blob || (blob.size != null && blob.size < 32)) throw new Error('empty pdf');
            return blob;
        }).catch(function (err) {
            destroyPdfCaptureRoot();
            try { console.warn('[WSApp] PDF export failed:', err); } catch (e) { /* ignore */ }
            throw err;
        });
    }

    function relayFileToParent(action, blob, filename, mime) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var base64 = String(reader.result || '').split(',')[1] || '';
                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'wsapp-test-report-file',
                            action: action,
                            filename: filename,
                            mime: mime || 'application/pdf',
                            data: base64
                        }, '*');
                        resolve();
                        return;
                    }
                } catch (e) { /* file:// */ }
                reject(new Error('no parent'));
            };
            reader.onerror = function () { reject(new Error('read failed')); };
            reader.readAsDataURL(blob);
        });
    }

    function deliverPdfBlob(blob, target, action) {
        var filename = buildPdfFilename(target);
        if (action === 'share') {
            var file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                return navigator.share({
                    files: [file],
                    title: utilityDisplayName(state.utility) + ' — ' + documentTargetLabel(target)
                }).then(function () {
                    showReportToast('Shared ' + documentTargetLabel(target) + ' PDF.', 'ok');
                });
            }
            if (document.body.classList.contains('wsapp-visual-embed')) {
                return relayFileToParent('share', blob, filename, 'application/pdf');
            }
            triggerBrowserDownload(blob, filename);
            showReportToast('Share unavailable — downloaded ' + documentTargetLabel(target) + ' PDF instead.', 'warn');
            return Promise.resolve();
        }
        if (document.body.classList.contains('wsapp-visual-embed')) {
            return relayFileToParent('download', blob, filename, 'application/pdf');
        }
        triggerBrowserDownload(blob, filename);
        showReportToast('Downloaded ' + documentTargetLabel(target) + ' PDF.', 'ok');
        return Promise.resolve();
    }

    function resolveSnapshotCss() {
        if (window.WSAPP_REPORT_SNAPSHOT_CSS) return window.WSAPP_REPORT_SNAPSHOT_CSS;
        return getReportSnapshotCss();
    }

    function buildStandaloneHtmlFromInner(innerHtml, target, css) {
        if (!innerHtml) return null;
        var title = target === 'summary' ? 'Meter Test Summary'
            : (target === 'full' ? 'Meter Test Report (Full)'
                : (target === 'charts' ? 'Meter Test Charts' : 'Meter Test Summary + Full Report'));
        var bodyClass = 'text-slate-800';
        if (target === 'summary') bodyClass += ' print-target-summary';
        else if (target === 'full') bodyClass += ' print-target-full';
        else if (target === 'both') bodyClass += ' print-target-both';
        return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>' + escapeHtml(title) + '</title><style>' + (css || resolveSnapshotCss()) + '</style></head><body class="' + bodyClass + '">' +
            innerHtml + '<p class="no-print report-html-export-hint">Open in a browser → Print → Save as PDF for best results.</p></body></html>';
    }

    function buildStandaloneHtmlDocument(target) {
        return buildStandaloneHtmlFromInner(getDocumentInnerHtml(target), target, resolveSnapshotCss());
    }

    function generateReportSnapshots(report, opts) {
        opts = opts || {};
        var C = window.WSAPP_CALC;
        if (!C || !report) return null;
        var prevUtility = state.utility;
        var prevMeta = state.meta;
        var prevReport = state.report;
        state.utility = opts.utility || loadUtilityFallback();
        state.meta = opts.meta || {
            saved_at: opts.savedAt || new Date().toISOString(),
            report_id: opts.reportId || ''
        };
        state.report = normalizeReportForDisplay(report, C);
        try {
            var summaryInner = buildSummarySection(state.report, C);
            var full = buildFullReportHtml(state.report, C, opts.bridge || null, state.meta);
            var fullInner = full.html.replace('<!--REPORT_NAV-->', buildSectionNav(full.navItems));
            var css = resolveSnapshotCss();
            return {
                summaryDocument: buildStandaloneHtmlFromInner(summaryInner, 'summary', css),
                fullDocument: buildStandaloneHtmlFromInner(fullInner, 'full', css),
                generatedAt: new Date().toISOString()
            };
        } finally {
            state.utility = prevUtility;
            state.meta = prevMeta;
            state.report = prevReport;
        }
    }

    function downloadDocumentHtml(target) {
        var doc = buildStandaloneHtmlDocument(target);
        if (!doc) {
            showReportToast('Nothing to download.', 'error');
            return Promise.resolve();
        }
        var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
        var filename = buildSnapshotFilename(target, 'html');
        if (document.body.classList.contains('wsapp-visual-embed')) {
            return relayFileToParent('download', blob, filename, 'text/html;charset=utf-8').then(function () {
                showReportToast('Downloaded ' + documentTargetLabel(target) + ' HTML.', 'ok');
            }).catch(function () {
                triggerBrowserDownload(blob, filename);
                showReportToast('Downloaded ' + documentTargetLabel(target) + ' HTML.', 'ok');
            });
        }
        triggerBrowserDownload(blob, filename);
        var msg = (target === 'summary' || target === 'full' || target === 'both')
            ? (documentTargetLabel(target) + ' HTML saved. Open it and use Print → Save as PDF.')
            : ('Downloaded ' + documentTargetLabel(target) + ' HTML.');
        showReportToast(msg, 'ok');
        return Promise.resolve();
    }

    function downloadDocument(target) {
        if (!state.report) return;
        if (!getPrintableRootElement(target)) {
            showReportToast('Nothing to download.', 'error');
            return;
        }
        downloadDocumentHtml(target);
    }

    function shareDocumentText(target) {
        var C = window.WSAPP_CALC;
        var text = target === 'summary' ? buildSummaryShareText(state.report, C)
            : (target === 'full' ? buildFullShareText(state.report, C)
                : (target === 'charts' ? buildSummaryShareText(state.report, C) + '\n\n(Charts — open download for graphics.)'
                    : buildBothShareText(state.report, C)));
        var title = utilityDisplayName(state.utility) + ' — ' +
            (target === 'summary' ? 'Meter Test Summary'
                : (target === 'full' ? 'Full Test Report'
                    : (target === 'charts' ? 'Charts / Graphs' : 'Meter Test Summary + Report')));

        function shareViaClipboard() {
            copyTextToClipboard(text).then(function () {
                showReportToast('Copied ' + documentTargetLabel(target) + ' text to clipboard.', 'ok');
            }).catch(function () {
                downloadDocument(target);
            });
        }

        if (shouldPreferClipboardShare()) {
            shareViaClipboard();
            return;
        }

        navigator.share({ title: title, text: text }).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            shareViaClipboard();
        });
    }

    function shareDocumentHtml(target) {
        var doc = buildStandaloneHtmlDocument(target);
        if (!doc) {
            showReportToast('Nothing to share.', 'error');
            return Promise.resolve();
        }
        var filename = buildSnapshotFilename(target, 'html');
        var file = new File([doc], filename, { type: 'text/html;charset=utf-8' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            return navigator.share({ files: [file], title: filename }).then(function () {
                showReportToast('Shared ' + documentTargetLabel(target) + ' HTML.', 'ok');
            });
        }
        if (document.body.classList.contains('wsapp-visual-embed')) {
            var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
            return relayFileToParent('share', blob, filename, 'text/html;charset=utf-8').catch(function () {
                shareDocumentText(target);
            });
        }
        shareDocumentText(target);
        return Promise.resolve();
    }

    function shareDocument(target) {
        if (!state.report) return;
        if (!getPrintableRootElement(target)) {
            showReportToast('Nothing to share.', 'error');
            return;
        }
        if (target === 'summary' || target === 'full' || target === 'charts' || target === 'both') {
            shareDocumentHtml(target).catch(function (err) {
                if (err && err.name === 'AbortError') return;
                shareDocumentText(target);
            });
            return;
        }
        shareDocumentText(target);
    }

    function printDocument(target) {
        var origTitle = document.title;
        document.title = '\u00a0';
        setPrintTargetClass(target);
        try { window.focus(); } catch (e) { /* ignore */ }
        if (target === 'summary' || target === 'full' || target === 'both') {
            showReportToast('Choose Save as PDF in the print dialog.', 'ok');
        }
        window.print();
        setTimeout(function () {
            document.title = origTitle;
            clearPrintTargetClass();
        }, 500);
    }

    /** Iframe modal actions target the active view (summary / full / charts). */
    function downloadHtmlSnapshot() { downloadDocument(getActiveDocumentTarget()); }
    function shareReport() { shareDocument(getActiveDocumentTarget()); }
    function printReport() { printDocument(getActiveDocumentTarget()); }

    function refreshReport() {
        var B = window.WSAPP_VISUAL_BRIDGE;
        if (B) B.requestParentRepublish();
        render();
    }

    function closeReport() {
        var B = window.WSAPP_VISUAL_BRIDGE;
        if (B) B.returnToWsapp();
    }

    function renderError(host, message) {
        host.innerHTML = '<div class="report-error-panel" role="alert">' +
            '<div class="font-semibold mb-2">Could not render this report</div>' +
            '<div class="text-sm">' + escapeHtml(message || 'Unknown error') + '</div>' +
            '<div class="text-xs text-slate-500 mt-3">Try Refresh or Load JSON with a valid field report backup.</div></div>';
    }

    function render() {
        var C = window.WSAPP_CALC;
        var B = window.WSAPP_VISUAL_BRIDGE;
        var host = document.getElementById('test-report-host');
        if (!C || !B || !host) return;

        try {
            var payload = B.loadPayload();
            state.utility = (payload && payload.utility) || loadUtilityFallback();
            state.meta = B.getSavedMeta();
            state.report = B.loadActiveFieldReport();

            if (!state.report) {
                host.innerHTML = '<div class="text-xs text-slate-500 text-center py-12 leading-relaxed">' +
                    'No active field report. Open a site in WSApp, then open <strong>Test Report</strong> from the field report nav.</div>';
                return;
            }

            state.view = getReportView();
            var built = buildReportHtml(state.report, C, B, state.meta, state.view);
            host.innerHTML = built.html.replace('<!--REPORT_NAV-->', buildSectionNav(built.navItems));
            applyViewLayout();
            syncStandaloneToolbar();
            notifyParentReady();
        } catch (err) {
            renderError(host, err && err.message ? err.message : String(err));
        }
    }

    function applyEmbedLayout() {
        var B = window.WSAPP_VISUAL_BRIDGE;
        if (!B || !B.isEmbedMode()) return;
        document.body.classList.add('wsapp-visual-embed');
    }

    function applyViewLayout() {
        document.body.classList.remove('report-view-summary', 'report-view-full', 'report-view-charts', 'report-view-all');
        var view = state.view || getReportView();
        document.body.classList.add('report-view-' + view);
    }

    function setToolbarGroupVisible(id, show) {
        var el = document.getElementById(id);
        if (el) el.style.display = show ? '' : 'none';
    }

    function syncStandaloneToolbar() {
        var view = state.view || getReportView();
        var printLabel = document.getElementById('btn-print-label');
        var downloadLabel = document.getElementById('btn-download-label');
        if (view === 'summary' || view === 'full' || view === 'all') {
            if (printLabel) printLabel.textContent = 'Print / PDF';
            if (downloadLabel) downloadLabel.textContent = 'Download HTML';
        } else {
            if (printLabel) printLabel.textContent = 'Print / PDF';
            if (downloadLabel) downloadLabel.textContent = 'Download HTML';
        }
    }

    function bindToolbarButton(id, handler) {
        var el = document.getElementById(id);
        if (el) el.onclick = handler;
    }

    function bindSectionPrintControls() {
        document.addEventListener('click', function (ev) {
            var btn = ev.target && ev.target.closest ? ev.target.closest('[data-print-section]') : null;
            if (!btn) return;
            ev.preventDefault();
            printSection(btn.getAttribute('data-print-section'));
        });
    }

    function bind() {
        var B = window.WSAPP_VISUAL_BRIDGE;
        applyEmbedLayout();
        bindSectionPrintControls();

        bindToolbarButton('btn-load-json', promptLoadReportJson);
        bindToolbarButton('btn-close', closeReport);
        bindToolbarButton('btn-print', function () { printDocument(getActiveDocumentTarget()); });
        bindToolbarButton('btn-share', function () { shareDocument(getActiveDocumentTarget()); });
        bindToolbarButton('btn-download', function () { downloadDocument(getActiveDocumentTarget()); });

        window.addEventListener('message', function (ev) {
            if (!ev.data || ev.data.type !== 'wsapp-test-report-action') return;
            runTestReportAction(ev.data.action);
        });

        window.addEventListener('focus', render);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) render();
        });
    }

    function runTestReportAction(action) {
        var active = getActiveDocumentTarget();
        var handlers = {
            print: function () { printDocument(active); },
            download: function () { downloadDocument(active); },
            share: function () { shareDocument(active); },
            'print-summary': function () { printDocument('summary'); },
            'print-full': function () { printDocument('full'); },
            'print-both': function () { printDocument('both'); },
            'download-summary': function () { downloadDocument('summary'); },
            'download-full': function () { downloadDocument('full'); },
            'download-both': function () { downloadDocument('both'); },
            'share-summary': function () { shareDocument('summary'); },
            'share-full': function () { shareDocument('full'); },
            'share-both': function () { shareDocument('both'); },
            'print-charts': function () { printDocument('charts'); },
            'download-charts': function () { downloadDocument('charts'); },
            'share-charts': function () { shareDocument('charts'); },
            refresh: refreshReport,
            close: closeReport
        };
        if (handlers[action]) handlers[action]();
    }

    function notifyParentReady() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'wsapp-test-report-ready' }, '*');
            }
        } catch (e) { /* file:// */ }
    }

    window.WSAPP_TEST_REPORT = {
        print: printReport,
        printSummary: function () { printDocument('summary'); },
        printFull: function () { printDocument('full'); },
        printBoth: function () { printDocument('both'); },
        printCharts: function () { printDocument('charts'); },
        download: downloadHtmlSnapshot,
        downloadCharts: function () { downloadDocument('charts'); },
        downloadSummary: function () { downloadDocument('summary'); },
        downloadFull: function () { downloadDocument('full'); },
        downloadBoth: function () { downloadDocument('both'); },
        share: shareReport,
        shareSummary: function () { shareDocument('summary'); },
        shareFull: function () { shareDocument('full'); },
        shareBoth: function () { shareDocument('both'); },
        shareCharts: function () { shareDocument('charts'); },
        getReportView: getReportView,
        refresh: refreshReport,
        close: closeReport,
        runAction: runTestReportAction,
        generateSnapshots: generateReportSnapshots,
        printSection: printSection,
        _test: {
            METER_TEST_TIER_BANDS: METER_TEST_TIER_BANDS,
            WATTHOUR_BUSINESS: WATTHOUR_BUSINESS,
            getMeterTestResultTier: getMeterTestResultTier,
            computeExecutiveFindings: computeExecutiveFindings,
            computeSummaryData: computeSummaryData,
            buildSummarySection: buildSummarySection,
            buildFullReportHtml: buildFullReportHtml,
            generateReportSnapshots: generateReportSnapshots,
            buildReportOverviewBlock: buildReportOverviewBlock,
            buildAccuracyBriefingSection: buildAccuracyBriefingSection,
            buildAssessmentSummarySection: buildAssessmentSummarySection,
            buildConsolidatedNotesSection: buildConsolidatedNotesSection,
            buildChartsDocumentHtml: buildChartsDocumentHtml,
            getReportView: getReportView,
            listImportableReports: listImportableReports,
            parseImportedReportPayload: parseImportedReportPayload,
            buildMeterTierLegend: buildMeterTierLegend,
            buildAccuracySection: buildAccuracySection,
            buildSectionNav: buildSectionNav
        }
    };

    if (!window.WSAPP_TEST_REPORT_SKIP_AUTO_INIT) {
        document.addEventListener('DOMContentLoaded', function () {
            state.view = getReportView();
            bind();
            render();
        });
    }
})();