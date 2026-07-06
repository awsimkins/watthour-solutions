/**
 * WSApp Test Report — JSON import / Load JSON (standalone use).
 */
(function () {
    'use strict';

    window.WSAPP_TR_IMPORT = {
        attach: function (api) {
            api.listImportableReports = listImportableReports;
            api.parseImportedReportPayload = parseImportedReportPayload;
            api.promptLoadReportJson = function () { return promptLoadReportJson(api); };
        }
    };

    function listImportableReports(raw) {
        var items = [];
        if (!raw || typeof raw !== 'object') return items;
        if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
            items.push({ report: raw.data, meta: { source: 'data_object' }, utility: raw.utility || '' });
            return items;
        }
        if (raw.data && Array.isArray(raw.data)) {
            raw.data.forEach(function (entry) {
                if (entry && entry.type === 'field_report' && entry.data) {
                    items.push({ report: entry.data, meta: { source: 'data_array', id: entry.id }, utility: entry.utility || '' });
                }
            });
            return items;
        }
        var store = raw.data_store || raw.entries;
        if (Array.isArray(store)) {
            store.forEach(function (entry) {
                if (entry && entry.type === 'field_report' && entry.data && !entry.is_draft) {
                    items.push({ report: entry.data, meta: { source: 'backup', id: entry.id }, utility: entry.utility || raw.current_utility || '' });
                }
            });
        }
        return items;
    }

    function parseImportedReportPayload(raw) {
        if (!raw || typeof raw !== 'object') return null;
        if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
            return { report: raw.data, utility: raw.utility || 'GENERAL', meta: { saved_at: raw.saved_at || '' } };
        }
        return null;
    }

    function promptLoadReportJson(api) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = function () {
            var file = input.files && input.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var raw = JSON.parse(String(reader.result || ''));
                    var direct = parseImportedReportPayload(raw);
                    if (direct) {
                        api.finishImport(direct);
                        return;
                    }
                    var items = listImportableReports(raw);
                    if (!items.length) {
                        api.showReportToast('No field reports found in that file.', 'error');
                        return;
                    }
                    if (items.length === 1) {
                        api.finishImport({ report: items[0].report, utility: items[0].utility, meta: items[0].meta });
                        return;
                    }
                    api.showReportImportPicker(items, function (picked) {
                        api.finishImport({ report: picked.report, utility: picked.utility, meta: picked.meta });
                    });
                } catch (e) {
                    api.showReportToast('Invalid JSON file.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
})();