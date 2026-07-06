/**
 * WSApp path manifest — single source for companion page URLs (project-root relative).
 * Include from any page; use WSAPP_PATHS.resolve() for href/src attributes.
 */
(function () {
    'use strict';

    /** Paths relative to deploy root (parent of launch.html, shared/, companions/). */
    var PATHS = {
        app: {
            index: 'launch.html',
            manifest: 'manifest.json',
            sw: 'sw.js'
        },
        shared: {
            calc: 'shared/scripts/wsapp-calculations.js',
            visualBridge: 'shared/scripts/wsapp-visual-bridge.js',
            utilityProfiles: 'shared/scripts/wsapp-utility-profiles.js',
            paths: 'shared/scripts/wsapp-paths.js',
            assets: 'shared/assets',
            logo: 'shared/assets/logo.png',
            tailwind: 'shared/assets/tailwindcdn.js',
            xlsx: 'shared/assets/xlsx.full.min.js',
            fontawesome: 'shared/assets/fontawesome/css/all.min.css',
            html2pdf: 'shared/assets/html2pdf.bundle.min.js',
            leafletCss: 'shared/assets/leaflet/leaflet.css',
            leafletJs: 'shared/assets/leaflet/leaflet.js'
        },
        companions: {
            testReport: 'companions/test-report/test-report.html',
            routeMap: 'companions/route-map/route-map.html',
            vectorDiagram: 'companions/charts/vector-diagram.html',
            ctAccuracy: 'companions/charts/ct-accuracy-graph.html',
            ctDrop: 'companions/charts/ct-drop-graph.html',
            ctParallelogram: 'companions/charts/ct-parallelogram.html',
            ptAccuracy: 'companions/charts/pt-accuracy-graph.html',
            ptDrop: 'companions/charts/pt-drop-graph.html'
        },
        charts: {
            chartBundle: 'companions/charts/scripts/wsapp-chart-bundle.js',
            visualShell: 'companions/charts/scripts/wsapp-visual-shell.js',
            visualTemplate: 'companions/charts/scripts/visual-page-template.js'
        },
        testReport: {
            main: 'companions/test-report/scripts/wsapp-test-report.js',
            export: 'companions/test-report/scripts/wsapp-test-report-export.js',
            import: 'companions/test-report/scripts/wsapp-test-report-import.js'
        },
        routeMap: {
            script: 'companions/route-map/scripts/wsapp-route-map.js'
        },
        storage: {
            activeReport: 'wsapp_active_field_report',
            fieldData: 'wsapp_field_data',
            masterList: 'wsapp_master_list',
            currentUtility: 'wsapp_current_utility',
            navReturn: 'wsapp_nav_return'
        }
    };

    function deployPrefixBefore(segment) {
        var needle = '/' + segment + '/';
        var p = (window.location.pathname || '').replace(/\\/g, '/');
        if (p.indexOf(needle) === -1 || p.indexOf('/companions/') !== -1) return null;
        var before = p.split(needle)[0];
        if (!before || before === '/') return '/' + segment + '/';
        return before.replace(/\/?$/, '/') + segment + '/';
    }

    function getDeployRootPrefix() {
        try {
            var p = (window.location.pathname || '').replace(/\\/g, '/');
            var wsappRoot = deployPrefixBefore('wsapp');
            if (wsappRoot) return wsappRoot;
            var fieldRoot = deployPrefixBefore('field');
            if (fieldRoot) return fieldRoot;
            if (p.indexOf('/app/') !== -1 && p.indexOf('/companions/') === -1) {
                var beforeApp = p.split('/app/')[0];
                if (!beforeApp || beforeApp === '/') return '/app/';
                return beforeApp.replace(/\/?$/, '/') + 'app/';
            }
            if (p.indexOf('/companions/') !== -1) {
                var beforeComp = p.split('/companions/')[0];
                if (!beforeComp || beforeComp === '/') return '/';
                return beforeComp.replace(/\/?$/, '/');
            }
        } catch (e) { /* ignore */ }
        var path = window.location.pathname || '';
        var parts = path.split('/').filter(Boolean);
        if (!parts.length) return './';
        if (parts[parts.length - 1].indexOf('.') !== -1) parts.pop();
        if (parts.length && parts[parts.length - 1] === 'app') return '../';
        if (parts.length >= 2 && parts[parts.length - 2] === 'companions') return '../../';
        if (parts.length >= 3 && parts[parts.length - 3] === 'companions') return '../../../';
        return './';
    }

    function resolve(relPath) {
        var root = getDeployRootPrefix();
        var url;
        if (root === './' || root === '') url = relPath;
        else if (root === '../') url = '../' + relPath;
        else if (root === '../../') url = '../../' + relPath;
        else if (root === '../../../') url = '../../../' + relPath;
        else url = root + relPath;
        if (url.indexOf('//') === 0 && url.charAt(2) !== '/') {
            url = '/' + url.replace(/^\/+/, '');
        }
        return url;
    }

    function absoluteUrl(relPath) {
        try {
            return new URL(resolve(relPath), window.location.href).href;
        } catch (e) {
            return resolve(relPath);
        }
    }

    function companionUrl(pageKey, query) {
        var rel = PATHS.companions[pageKey];
        if (!rel) return '';
        var url = absoluteUrl(rel);
        if (query) url += (url.indexOf('?') === -1 ? '?' : '&') + query;
        return url;
    }

    window.WSAPP_PATHS = {
        paths: PATHS,
        resolve: resolve,
        absoluteUrl: absoluteUrl,
        companionUrl: companionUrl,
        appIndex: function () { return absoluteUrl(PATHS.app.index); }
    };
})();