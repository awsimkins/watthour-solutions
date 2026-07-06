/**
 * WSApp Route Map — standalone companion page (route-map.html).
 * Reads wsapp_master_list + wsapp_field_data from localStorage (same origin as index.html).
 */
(function () {
    'use strict';

    var STATUS = { pending: 'pending', completed: 'completed', skipped: 'skipped' };
    var COLORS = {
        pending: '#16a34a',
        completed: '#64748b',
        skipped: '#dc2626',
        selected: '#0ea5e9',
        user: '#2563eb'
    };

    var map = null;
    var userMarker = null;
    var userLatLng = null;
    var siteLayers = [];
    var sites = [];
    var selectedKey = null;

    function isFieldReportDraft(entry) {
        if (!entry || entry.type !== 'field_report') return false;
        var v = entry.is_draft;
        if (v === false || v === 0 || v === null || v === undefined) return false;
        var s = String(v).trim().toLowerCase();
        return s !== '' && s !== 'false' && s !== '0' && s !== 'no';
    }

    function isCompletedFieldReportEntry(entry) {
        if (!entry || entry.type !== 'field_report' || !entry.data) return false;
        if (!isFieldReportDraft(entry)) return true;
        var d = entry.data;
        return !!(d.time_in && String(d.time_in).trim() && d.time_out && String(d.time_out).trim());
    }

    function getFieldReportMeterNumber(data) {
        if (!data) return '';
        return data.meter_number || data.meter_id || data.meter || '';
    }

    function getFieldReportLocation(data) {
        if (!data) return '';
        return data.location_number || data.location || data.site_location_number || '';
    }

    function getFieldReportOrderKey(data) {
        if (!data) return '';
        return data.route_number || data.order_id || data.route || '';
    }

    function normalizeSiteMeterKey(meter) {
        var s = String(meter == null ? '' : meter).trim().toLowerCase();
        if (!s) return '';
        var digits = s.replace(/\D/g, '');
        if (digits.length >= 4 && digits.length >= s.replace(/[\s._-]/g, '').length - 2) {
            return digits;
        }
        return s;
    }

    function normalizeSiteLocKey(loc) {
        return String(loc || '').trim().toLowerCase();
    }

    function getMasterOrderId(rec) {
        return String((rec && (rec.order_id || rec.route_number || rec.route)) || '').trim();
    }

    function getMasterLocationId(rec) {
        return String((rec && (rec.location_id || rec.map_location_number || rec.location || rec.map || rec.location_key)) || '').trim();
    }

    function getMasterCustomerMemberId(rec) {
        return String((rec && (rec.customer_member_id || rec.customer_name || rec.customer || rec.member)) || '').trim();
    }

    function getMasterMeterId(rec) {
        if (!rec) return '';
        var raw = rec.meter_id != null && rec.meter_id !== '' ? rec.meter_id : rec.meter;
        return String(raw == null ? '' : raw).trim();
    }

    function getMasterLocationKey(rec) {
        var meter = normalizeSiteMeterKey(getMasterMeterId(rec));
        if (meter) return 'm:' + meter;
        var loc = normalizeSiteLocKey(getMasterLocationId(rec));
        if (loc) return 'l:' + loc;
        return '';
    }

    function canonicalizeMasterRecord(rec) {
        if (!rec || typeof rec !== 'object') return rec;
        var out = Object.assign({}, rec);
        if (!out.order_id && out.route_number != null && String(out.route_number).trim() !== '') {
            out.order_id = String(out.route_number).trim();
        }
        if (!out.order_id && out.route) out.order_id = out.route;
        if (!out.location_id) out.location_id = out.map_location_number || out.location || out.map || out.location_key || '';
        if (!out.customer_member_id) out.customer_member_id = out.customer_name || out.customer || out.member || '';
        if (out.meter_id == null || String(out.meter_id).trim() === '') {
            if (out.meter != null && String(out.meter).trim() !== '') out.meter_id = out.meter;
        }
        if (out.meter_id != null) out.meter_id = String(out.meter_id).trim();
        if (!out.service_address && out.address) out.service_address = out.address;
        if (!out.latitude && out.lat) out.latitude = out.lat;
        if (!out.longitude && out.long) out.longitude = out.long;
        return out;
    }

    function parseCoords(rec) {
        var lat = parseFloat(rec.latitude || rec.lat);
        var lon = parseFloat(rec.longitude || rec.long);
        if (!isFinite(lat) || !isFinite(lon)) return null;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
        return { lat: lat, lon: lon };
    }

    function siteDataMatchesMasterSite(data, locKey, meterKey, orderKey) {
        if (!data) return false;
        var masterMeter = normalizeSiteMeterKey(meterKey);
        var entryMeter = normalizeSiteMeterKey(getFieldReportMeterNumber(data));
        var masterLoc = normalizeSiteLocKey(locKey);
        var entryLoc = normalizeSiteLocKey(getFieldReportLocation(data));
        var masterOrder = String(orderKey || '').trim();
        var entryRoute = String(getFieldReportOrderKey(data)).trim();
        if (masterMeter) {
            if (entryMeter && entryMeter === masterMeter) return true;
            if (masterOrder && entryRoute && masterOrder === entryRoute) {
                if (!masterLoc || !entryLoc || entryLoc === masterLoc) return true;
            }
            if (entryMeter) return false;
            return false;
        }
        if (masterOrder && entryRoute && masterOrder === entryRoute) {
            return !masterLoc || !entryLoc || entryLoc === masterLoc;
        }
        return masterLoc !== '' && entryLoc === masterLoc;
    }

    function loadFieldData() {
        try {
            var raw = localStorage.getItem('wsapp_field_data');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function getVisitStatus(locKey, meterKey, orderKey, dataStore) {
        if (!locKey && !meterKey && !orderKey) return null;
        var masterMeter = normalizeSiteMeterKey(meterKey);
        if (masterMeter) {
            var byMeter = dataStore.find(function (e) {
                return isCompletedFieldReportEntry(e) &&
                    normalizeSiteMeterKey(getFieldReportMeterNumber(e.data)) === masterMeter;
            });
            if (byMeter) return { status: STATUS.completed, date: (byMeter.data && byMeter.data.visit_date) || byMeter.created };
        }
        var comp = dataStore.find(function (e) {
            return isCompletedFieldReportEntry(e) &&
                siteDataMatchesMasterSite(e.data, locKey, meterKey, orderKey);
        });
        if (comp) return { status: STATUS.completed, date: (comp.data && comp.data.visit_date) || comp.created };

        var skip = dataStore.find(function (e) {
            return e.type === 'unable_event' &&
                siteDataMatchesMasterSite(e.data, locKey, meterKey, orderKey);
        });
        if (skip) {
            return {
                status: STATUS.skipped,
                reason: (skip.data && skip.data.reason) || 'Unable to Complete',
                date: (skip.data && skip.data.date) || skip.created
            };
        }
        return null;
    }

    function loadSites() {
        var utility = localStorage.getItem('wsapp_current_utility') || 'GENERAL';
        var masterRaw = null;
        try {
            masterRaw = JSON.parse(localStorage.getItem('wsapp_master_list') || 'null');
        } catch (e) {
            masterRaw = null;
        }
        var records = (masterRaw && masterRaw.records) ? masterRaw.records : [];
        var dataStore = loadFieldData();
        var list = [];

        records.forEach(function (rec) {
            rec = canonicalizeMasterRecord(rec);
            if (utility && utility !== 'GENERAL' && rec.utility && (rec.utility || 'GENERAL') !== utility) return;

            var coords = parseCoords(rec);
            var loc = getMasterLocationId(rec);
            var meter = getMasterMeterId(rec);
            var order = getMasterOrderId(rec);
            var visit = getVisitStatus(loc, meter, order, dataStore);
            var status = visit ? visit.status : STATUS.pending;

            list.push({
                key: getMasterLocationKey(rec) || loc,
                rec: rec,
                coords: coords,
                status: status,
                visit: visit,
                label: [loc, getMasterCustomerMemberId(rec), meter].filter(Boolean).join(', ')
            });
        });

        return {
            utility: utility,
            masterName: (masterRaw && masterRaw.name) || '',
            sites: list,
            withGps: list.filter(function (s) { return s.coords; }).length,
            missingGps: list.filter(function (s) { return !s.coords; }).length
        };
    }

    function haversineMiles(lat1, lon1, lat2, lon2) {
        var R = 3958.7613;
        var toRad = function (d) { return d * Math.PI / 180; };
        var dLat = toRad(lat2 - lat1);
        var dLon = toRad(lon2 - lon1);
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function statusLabel(status) {
        if (status === STATUS.completed) return 'Completed';
        if (status === STATUS.skipped) return 'Skipped';
        return 'Pending';
    }

    function filterVisible(site) {
        if (!site.coords) return false;
        if (site.status === STATUS.pending && document.getElementById('filter-pending').checked) return true;
        if (site.status === STATUS.completed && document.getElementById('filter-completed').checked) return true;
        if (site.status === STATUS.skipped && document.getElementById('filter-skipped').checked) return true;
        return false;
    }

    function googleMapsUrl(lat, lon) {
        return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(lat + ',' + lon);
    }

    function returnToWsapp(locKey) {
        if (locKey) {
            sessionStorage.setItem('wsapp_nav_return', JSON.stringify({ locKey: locKey, from: 'route-map', ts: Date.now() }));
        }
        var appUrl = (window.WSAPP_PATHS && window.WSAPP_PATHS.appIndex)
            ? window.WSAPP_PATHS.appIndex()
            : '../../launch.html';
        window.location.href = appUrl;
    }

    function setSelected(key) {
        selectedKey = key;
        renderMarkers();
        var site = sites.find(function (s) { return s.key === key; });
        updateDetailPanel(site || null);
        if (site && site.coords && map) {
            map.panTo([site.coords.lat, site.coords.lon]);
        }
    }

    function buildPopupHtml(site) {
        var dist = '';
        if (userLatLng && site.coords) {
            var mi = haversineMiles(userLatLng.lat, userLatLng.lng, site.coords.lat, site.coords.lon);
            dist = '<div class="text-xs text-slate-500 mt-1">' + mi.toFixed(1) + ' mi (straight line)</div>';
        }
        var skipNote = (site.visit && site.status === STATUS.skipped)
            ? '<div class="text-xs text-red-600">' + escapeHtml(site.visit.reason) + '</div>' : '';

        return '<div class="text-sm min-w-[200px]">' +
            '<div class="font-semibold text-slate-800">' + escapeHtml(getMasterLocationId(site.rec)) + '</div>' +
            '<div class="text-slate-600">' + escapeHtml(getMasterCustomerMemberId(site.rec)) + '</div>' +
            '<div class="text-xs text-slate-500">Meter ' + escapeHtml(getMasterMeterId(site.rec) || '—') + '</div>' +
            '<div class="mt-1"><span class="text-xs font-medium px-1.5 py-0.5 rounded-full ' +
            (site.status === STATUS.pending ? 'bg-green-100 text-green-800' :
                site.status === STATUS.completed ? 'bg-slate-200 text-slate-700' : 'bg-red-100 text-red-800') +
            '">' + statusLabel(site.status) + '</span></div>' +
            skipNote + dist +
            '<div class="mt-2 flex flex-wrap gap-1">' +
            '<button type="button" class="map-popup-nav px-2 py-1 text-xs bg-blue-600 text-white rounded-lg" data-key="' + escapeHtml(site.key) + '">Navigate</button>' +
            '<button type="button" class="map-popup-wsapp px-2 py-1 text-xs bg-emerald-700 text-white rounded-lg" data-key="' + escapeHtml(site.key) + '">Back to WSApp</button>' +
            '</div></div>';
    }

    function wirePopupButtons(layer, site) {
        layer.on('popupopen', function () {
            var popup = layer.getPopup();
            if (!popup || !popup.getElement()) return;
            var el = popup.getElement();
            var navBtn = el.querySelector('.map-popup-nav');
            var wsappBtn = el.querySelector('.map-popup-wsapp');
            if (navBtn) {
                navBtn.onclick = function () {
                    if (site.coords) window.open(googleMapsUrl(site.coords.lat, site.coords.lon), '_blank');
                };
            }
            if (wsappBtn) {
                wsappBtn.onclick = function () {
                    returnToWsapp(site.key);
                };
            }
        });
    }

    function markerRadius(site) {
        if (site.key === selectedKey) return 11;
        return site.status === STATUS.pending ? 8 : 7;
    }

    function markerColor(site) {
        if (site.key === selectedKey) return COLORS.selected;
        if (site.status === STATUS.completed) return COLORS.completed;
        if (site.status === STATUS.skipped) return COLORS.skipped;
        return COLORS.pending;
    }

    function renderMarkers(fitAll) {
        if (!map) return;
        siteLayers.forEach(function (layer) { map.removeLayer(layer); });
        siteLayers = [];

        var bounds = [];
        sites.forEach(function (site) {
            if (!filterVisible(site)) return;
            var layer = L.circleMarker([site.coords.lat, site.coords.lon], {
                radius: markerRadius(site),
                color: '#ffffff',
                weight: 2,
                fillColor: markerColor(site),
                fillOpacity: site.key === selectedKey ? 1 : 0.9
            });
            layer.siteKey = site.key;
            layer.bindPopup(buildPopupHtml(site));
            wirePopupButtons(layer, site);
            layer.on('click', function () { setSelected(site.key); });
            layer.addTo(map);
            siteLayers.push(layer);
            bounds.push([site.coords.lat, site.coords.lon]);
        });

        if (!fitAll) return;

        if (userLatLng && userMarker) {
            bounds.push([userLatLng.lat, userLatLng.lng]);
        }

        if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else if (bounds.length === 1) {
            map.setView(bounds[0], 14);
        }
    }

    function updateDetailPanel(site) {
        var panel = document.getElementById('site-detail');
        var empty = document.getElementById('site-detail-empty');
        if (!panel || !empty) return;

        if (!site) {
            panel.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        panel.classList.remove('hidden');

        document.getElementById('detail-title').textContent = getMasterLocationId(site.rec) || 'Site';
        document.getElementById('detail-customer').textContent = getMasterCustomerMemberId(site.rec) || '—';
        document.getElementById('detail-meter').textContent = getMasterMeterId(site.rec) || '—';
        document.getElementById('detail-address').textContent = site.rec.service_address || site.rec.address || '—';
        document.getElementById('detail-status').textContent = statusLabel(site.status);

        var distEl = document.getElementById('detail-distance');
        if (userLatLng && site.coords) {
            distEl.textContent = haversineMiles(userLatLng.lat, userLatLng.lng, site.coords.lat, site.coords.lon).toFixed(1) + ' mi away';
            distEl.classList.remove('hidden');
        } else {
            distEl.classList.add('hidden');
        }

        document.getElementById('btn-detail-navigate').onclick = function () {
            if (site.coords) window.open(googleMapsUrl(site.coords.lat, site.coords.lon), '_blank');
        };
        document.getElementById('btn-detail-wsapp').onclick = function () {
            returnToWsapp(site.key);
        };
    }

    function findNearestPending() {
        if (!userLatLng) {
            alert('Enable location access to find the nearest pending site.');
            return null;
        }
        var best = null;
        var bestDist = Infinity;
        sites.forEach(function (site) {
            if (!site.coords || site.status !== STATUS.pending) return;
            var d = haversineMiles(userLatLng.lat, userLatLng.lng, site.coords.lat, site.coords.lon);
            if (d < bestDist) {
                bestDist = d;
                best = site;
            }
        });
        return best;
    }

    function goNearestPending() {
        var site = findNearestPending();
        if (!site) {
            alert('No pending sites with GPS coordinates found.');
            return;
        }
        setSelected(site.key);
        if (map) {
            map.flyTo([site.coords.lat, site.coords.lon], 15, { duration: 0.8 });
            var layer = siteLayers.find(function (l) { return l.siteKey === site.key; });
            if (layer) layer.openPopup();
        }
    }

    function centerOnUser() {
        if (!userLatLng || !map) {
            alert('Waiting for your GPS location…');
            startUserLocation();
            return;
        }
        map.flyTo([userLatLng.lat, userLatLng.lng], 14, { duration: 0.6 });
    }

    function startUserLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.watchPosition(function (pos) {
            userLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (!map) return;
            if (!userMarker) {
                userMarker = L.circleMarker([userLatLng.lat, userLatLng.lng], {
                    radius: 9,
                    color: '#ffffff',
                    weight: 3,
                    fillColor: COLORS.user,
                    fillOpacity: 1
                }).addTo(map);
                userMarker.bindTooltip('You are here', { permanent: false, direction: 'top' });
            } else {
                userMarker.setLatLng([userLatLng.lat, userLatLng.lng]);
            }
            var statusEl = document.getElementById('gps-status');
            if (statusEl) statusEl.textContent = 'GPS active';
        }, function (err) {
            var statusEl = document.getElementById('gps-status');
            if (statusEl) {
                if (err && err.code === 1) statusEl.textContent = 'GPS denied — allow in Settings';
                else if (err && err.code === 3) statusEl.textContent = 'GPS timed out — try Center Me';
                else statusEl.textContent = 'GPS unavailable';
            }
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
    }

    function applySearch(query) {
        var q = String(query || '').trim().toLowerCase();
        if (!q) {
            sites.forEach(function (site) {
                if (site.coords && filterVisible(site)) return;
            });
            renderMarkers();
            return;
        }
        var match = sites.find(function (site) {
            return site.label.toLowerCase().indexOf(q) !== -1 && site.coords;
        });
        if (match) {
            setSelected(match.key);
            if (map) {
                map.flyTo([match.coords.lat, match.coords.lon], 15, { duration: 0.8 });
                var layer = siteLayers.find(function (l) { return l.siteKey === match.key; });
                if (layer) layer.openPopup();
            }
        }
    }

    function showEmptyState(message) {
        document.getElementById('map-root').innerHTML =
            '<div class="flex items-center justify-center h-full p-8 text-center text-slate-600">' +
            '<div><p class="text-lg font-semibold mb-2">No route data</p><p class="text-sm mb-4">' + escapeHtml(message) + '</p>' +
            '<button type="button" id="empty-back" class="px-4 py-2 bg-emerald-700 text-white rounded-2xl text-sm font-semibold">Back to WSApp</button></div></div>';
        var btn = document.getElementById('empty-back');
        if (btn) btn.onclick = function () { returnToWsapp(); };
    }

    function configureLeafletDefaultIcons() {
        if (typeof L === 'undefined' || !L.Icon || !L.Icon.Default) return;
        var P = window.WSAPP_PATHS;
        var base = (P && P.resolve) ? P.resolve('shared/assets/leaflet/images/') : '../../shared/assets/leaflet/images/';
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconUrl: base + 'marker-icon.png',
            iconRetinaUrl: base + 'marker-icon-2x.png',
            shadowUrl: base + 'marker-shadow.png'
        });
    }

    function initMap(data) {
        configureLeafletDefaultIcons();
        sites = data.sites;
        var mappable = sites.filter(function (s) { return s.coords; });

        document.getElementById('map-utility').textContent = data.utility;
        document.getElementById('map-stats').textContent =
            mappable.length + ' on map · ' + data.missingGps + ' missing GPS · ' + sites.length + ' total';
        if (data.masterName) {
            document.getElementById('map-list-name').textContent = data.masterName;
        }

        if (!mappable.length) {
            showEmptyState('Load a master list in WSApp first, or add GPS coordinates to your sites.');
            return;
        }

        var center = mappable[0].coords;
        map = L.map('map-canvas', { zoomControl: true }).setView([center.lat, center.lon], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        }).addTo(map);

        renderMarkers(true);
        startUserLocation();

        document.getElementById('btn-back-wsapp').onclick = function () { returnToWsapp(selectedKey || null); };
        document.getElementById('btn-nearest').onclick = goNearestPending;
        document.getElementById('btn-center-me').onclick = centerOnUser;
        document.getElementById('btn-refresh').onclick = function () {
            var fresh = loadSites();
            sites = fresh.sites;
            document.getElementById('map-stats').textContent =
                fresh.withGps + ' on map · ' + fresh.missingGps + ' missing GPS · ' + fresh.sites.length + ' total';
            renderMarkers();
        };

        ['filter-pending', 'filter-completed', 'filter-skipped'].forEach(function (id) {
            document.getElementById(id).onchange = renderMarkers;
        });

        document.getElementById('map-search').onkeydown = function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applySearch(this.value);
            }
        };
    }

    window.addEventListener('DOMContentLoaded', function () {
        if (typeof L === 'undefined') {
            showEmptyState('Map library failed to load. Connect to the internet and reload this page.');
            return;
        }
        var data = loadSites();
        if (!data.sites.length) {
            showEmptyState('Upload a master list in WSApp, then open Route Map again.');
            return;
        }
        initMap(data);
    });
})();