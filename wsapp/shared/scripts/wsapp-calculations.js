/**
 * WSApp Calculations — SINGLE SOURCE OF TRUTH
 *
 * All meter-test math and billing rates live here. Tweak formulas in this file only;
 * index.html and systems-check.js both load this module.
 *
 * Browser: inlined into index.html via npm run sync-calc → window.WSAPP_CALC
 * Node:    require('./wsapp-calculations.js')
 */
(function(wsappCalcFactory) {
    'use strict';

    /**
     * Canonical meter forms — legacy aliases normalize via normalizeMeterForm().
     * Families: 2S; 3S; 4S; 5S(+35S,45S); 6S(+36S); 9S(+8S); 12S; 16S; 25S
     */
    var METER_FORM_CANONICAL = ['2S', '3S', '4S', '5S', '6S', '9S', '12S', '16S', '25S'];
    var ZERO_CT_FORMS = ['2S', '12S', '16S', '25S'];
    var TWO_CT_FORMS = ['4S', '5S'];
    var THREE_CT_FORMS = ['6S', '9S'];
    var THREE_PHASE_DEFAULT_FORMS = ['5S', '6S', '9S'];
    var FIVE_S_FAMILY = ['5S'];
    var SIX_S_FAMILY = ['6S'];
    var NINE_S_FAMILY = ['9S'];
    /** 9S wye field layout — usage phase angles + 3 PT/VT when PT in service. */
    var NINE_S_WYE_FORMS = ['9S'];
var BURDEN_OHMS_LIST = ['0.0', '0.1', '0.2', '0.5', '1.0', '2.0', '4.0'];
var PT_BURDEN_VA_LIST = ['0', '25', '50', '75', '100', '125', '150', '175'];

function normalizeMeterForm(form) {
    if (!form) return '';
    var raw = String(form).trim();
    if (!raw) return '';
    var upper = raw.toUpperCase().replace(/\s+/g, '');
    var aliases = {
        '35S': '5S',
        '45S': '5S',
        '45S(5S)': '5S',
        '36S': '6S',
        '36S(6S)': '6S',
        '9S(36S)': '6S',
        '8S': '9S',
        '9S(8S)': '9S',
        '9S/8S': '9S',
        '14S': '16S',
        '15S': '16S',
        '16S(15S)': '16S'
    };
    if (aliases[upper]) return aliases[upper];
    var i;
    for (i = 0; i < METER_FORM_CANONICAL.length; i++) {
        if (METER_FORM_CANONICAL[i].toUpperCase() === upper) return METER_FORM_CANONICAL[i];
    }
    return raw;
}

function isNineSWyeForm(form) {
    return NINE_S_WYE_FORMS.indexOf(normalizeMeterForm(form || '')) !== -1;
}

function getCtCountForForm(form) {
    var f = normalizeMeterForm(form);
    if (ZERO_CT_FORMS.indexOf(f) !== -1) return 0;
    if (f === '3S') return 1;
    if (TWO_CT_FORMS.indexOf(f) !== -1) return 2;
    if (THREE_CT_FORMS.indexOf(f) !== -1) return 3;
    return 0;
}

function getReportForm(report) {
    return normalizeMeterForm((report && (report.form || report.meter_form)) || '4S');
}

function getPhaseFromServiceDesc(serviceDesc) {
    var s = String(serviceDesc || '').trim().toLowerCase();
    if (!s) return null;
    if (s.indexOf('3-phase') === 0 || s.indexOf('3 phase') === 0) return '3';
    if (s.indexOf('1-phase') === 0 || s.indexOf('1 phase') === 0) return '1';
    return null;
}

function getReportPhase(report) {
    var fromDesc = getPhaseFromServiceDesc(report && report.service_desc);
    if (fromDesc) return fromDesc;
    var p = String((report && report.phase) || '').trim();
    if (p === '3' || p.toLowerCase() === '3-phase' || p.toLowerCase() === 'three') return '3';
    if (p === '1' || p.toLowerCase() === '1-phase' || p.toLowerCase() === 'single') return '1';
    var form = getReportForm(report);
    if (THREE_PHASE_DEFAULT_FORMS.indexOf(form) !== -1) return '3';
    return '1';
}

function getListedMultiplier(report) {
    if (!report) return '';
    return String(report.listed_multiplier || report.multiplier || '').trim();
}

function parseCtRatioNameplate(ratioSize) {
    if (!ratioSize) return 0;
    var s = String(ratioSize).trim();
    var m = s.match(/^(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : 0;
}

/** CT ratio factor — 200:5 or nameplate 200 (means 200:5) → 40. */
function getCtRatioFactor(ratioSize) {
    var s = String(ratioSize || '').trim();
    if (!s) return 1;
    var m = s.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
    if (m) {
        var den = Number(m[2]);
        return den ? Number(m[1]) / den : Number(m[1]);
    }
    var n = parseCtRatioNameplate(ratioSize);
    return n > 0 ? n / 5 : 1;
}

function describeCtRatioForFormula(ratioSize) {
    var s = String(ratioSize || '').trim();
    if (!s) return '1';
    var m = s.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
    if (m) return m[1] + '/' + m[2];
    var n = parseCtRatioNameplate(ratioSize);
    return n > 0 ? n + '/5' : '1';
}

function parsePtRatioParts(ratioSize) {
    var s = String(ratioSize || '').trim();
    if (!s) return { primary: 120, secondary: 120 };
    var m = s.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
    if (m) return { primary: Number(m[1]), secondary: Number(m[2]) };
    var n = Number(s.replace(/,/g, ''));
    if (!isNaN(n) && n > 0) return { primary: n, secondary: 120 };
    return { primary: 120, secondary: 120 };
}

/** PT/VT ratio factor — 7200:120 or nameplate 7200 → 60; blank → 1. */
function getPtVtRatioFactor(ratioSize) {
    var parts = parsePtRatioParts(ratioSize);
    if (parts.primary > 0 && parts.secondary > 0) return parts.primary / parts.secondary;
    return 1;
}

function describePtRatioForFormula(ratioSize) {
    var parts = parsePtRatioParts(ratioSize);
    if (!String(ratioSize || '').trim()) return '120/120';
    if (String(ratioSize).match(/[:/]/)) return parts.primary + '/' + parts.secondary;
    if (parts.primary > 0) return parts.primary + '/120';
    return '120/120';
}

function formatCalculatedMultiplierValue(val) {
    if (val == null || val === '' || isNaN(val)) return '';
    var n = Number(val);
    if (!isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 0.0005) return String(Math.round(n));
    return String(Math.round(n * 100) / 100);
}

function isThreePhaseMultiplierForm(form) {
    var f = normalizeMeterForm(form || '');
    return THREE_PHASE_DEFAULT_FORMS.indexOf(f) !== -1;
}

function normalizePtSizeNameplate(val) {
    return String(val || '').replace(/\s*[:/]\s*120\s*$/i, '').trim();
}

function getReportPtVtRatioLabel(report) {
    if (!report) return '';
    var accountPt = report.pt_size && String(report.pt_size).trim();
    var accountNorm = accountPt ? normalizePtSizeNameplate(accountPt) : '';
    var pts = (report.pts || []).filter(function(pt) {
        return String(pt.ratio_size || '').trim();
    });
    if (pts.length > 0) {
        var blockRatio = String(pts[0].ratio_size).trim();
        var blockNorm = normalizePtSizeNameplate(blockRatio);
        if (accountNorm) {
            if (!blockNorm) return accountPt;
            // Account wins when PT block still has a partial value from live account typing (e.g. "8" vs "8400")
            if (accountNorm !== blockNorm && accountNorm.indexOf(blockNorm) === 0) return accountPt;
        }
        return blockRatio;
    }
    if (accountPt) return accountPt;
    return '';
}

function getReportCtRatioLabel(report, ctIndex) {
    if (!report) return '';
    var idx = ctIndex == null ? 0 : ctIndex;
    var accountCt = report.ct_size && String(report.ct_size).trim();
    var ct = report.cts && report.cts[idx];
    var blockRatio = ct && String(ct.ratio_size || '').trim();

    if (accountCt) {
        var accountNorm = String(accountCt).replace(/:5\s*$/i, '').trim();
        var blockNorm = String(blockRatio || '').replace(/:5\s*$/i, '').trim();
        // Account CT size wins when blocks are empty or still at factory default 200
        if (!blockNorm || (blockNorm === '200' && accountNorm !== '200')) return accountCt;
    }
    if (blockRatio) return blockRatio;
    if (accountCt) return accountCt;
    return '';
}

function getTimeBatchCtRatio(report) {
    return getReportCtRatioLabel(report, 0);
}

function getTimeBatchPtRatio(report) {
    return getReportPtVtRatioLabel(report);
}

function getReportPtVtFactor(report) {
    var label = getReportPtVtRatioLabel(report);
    if (!label) return 1;
    return getPtVtRatioFactor(label);
}

var USAGE_PRIMARY_VOLT_FIELDS = [
    'primary_volts_an', 'primary_volts_bn', 'primary_volts_cn',
    'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca'
];

var USAGE_SECONDARY_PRIMARY_VOLT_PAIRS = [
    ['secondary_volts_an', 'primary_volts_an'],
    ['secondary_volts_bn', 'primary_volts_bn'],
    ['secondary_volts_cn', 'primary_volts_cn'],
    ['secondary_volts_ab', 'primary_volts_ab'],
    ['secondary_volts_bc', 'primary_volts_bc'],
    ['secondary_volts_ca', 'primary_volts_ca']
];

function getReportPtPrimaryNameplate(report) {
    var label = getReportPtVtRatioLabel(report);
    if (!label) return 0;
    return parsePtRatioParts(label).primary;
}

/** PT nameplate primary > 600 V — usage primary volts autofill from secondary × PT multiplier. */
function isHighVoltagePtService(report) {
    return getReportPtPrimaryNameplate(report) > 600;
}

function computeUsagePrimaryVoltFromSecondary(secondaryVal, report) {
    var s = String(secondaryVal == null ? '' : secondaryVal).trim();
    if (!s) return '';
    var sec = Number(s.replace(/,/g, ''));
    if (isNaN(sec)) return '';
    var factor = getReportPtVtFactor(report);
    var result = sec * factor;
    if (!isFinite(result)) return '';
    if (Math.abs(result - Math.round(result)) < 0.05) return String(Math.round(result));
    return String(Math.round(result * 10) / 10);
}

function getUsagePrimaryVoltAutofillPairs(report) {
    if (report && getReportForm(report) === '3S') {
        return [];
    }
    if (report && isSelfContainedMeterForm(getReportForm(report))) {
        return getSelfContainedPrimaryVoltMirrorPairs(report);
    }
    return USAGE_SECONDARY_PRIMARY_VOLT_PAIRS;
}

function applyUsagePrimaryVoltAutofill(report) {
    if (!report || !isHighVoltagePtService(report)) return report;
    getUsagePrimaryVoltAutofillPairs(report).forEach(function(pair) {
        report[pair[1]] = computeUsagePrimaryVoltFromSecondary(report[pair[0]], report);
    });
    return report;
}

function getMissingUsagePrimaryVolts(report) {
    if (!report) return [];
    if (isSelfContainedMeterForm(getReportForm(report))) return [];
    if (!getReportPtVtRatioLabel(report)) return [];
    var labels = {
        primary_volts_an: 'A-N', primary_volts_bn: 'B-N', primary_volts_cn: 'C-N',
        primary_volts_ab: 'A-B', primary_volts_bc: 'B-C', primary_volts_ca: 'C-A'
    };
    var fieldsToCheck = USAGE_PRIMARY_VOLT_FIELDS;
    if (getReportForm(report) === '3S') {
        return [];
    }
    var missing = [];
    fieldsToCheck.forEach(function(field) {
        if (!String(report[field] || '').trim()) missing.push(labels[field] || field);
    });
    return missing;
}

function isCenterTapped(report) {
    return report && (report.trans_centertapped === 'YES' || report.service_center_tapped === 'YES');
}

// --- Billing (invoice_batch + fullbatch billing_code / billing_rate) ---

var BILLING_RATES = {
    SC: 70,
    '1PhCT': 102,
    '1PhCTPT': 112,
    '1Ph2CT': 107,
    '1Ph2CTPT': 117,
    '3PhCT': 123,
    '3PhCTPT': 146
};

var SELF_CONTAINED_FORMS = ['2S', '12S', '16S', '25S'];

/** Per-utility rate multipliers applied after base billing code rate (e.g. cooperative surcharge). */
var UTILITY_BILLING_SURCHARGE = {
    'PETIT JEAN ELECTRIC COOPERATIVE': 0.03
};

function hasPtVtInstalled(report) {
    if (!report) return false;
    if (report.trans_centertapped === 'YES' || report.service_center_tapped === 'YES') return true;
    if (getReportPtVtRatioLabel(report)) return true;
    if (report.pts && report.pts.some(function(pt) {
        return String(pt.ratio_size || pt.mfg || pt.serial_number || '').trim();
    })) return true;
    if (report.pt_size && String(report.pt_size).trim()) return true;
    return false;
}

function formatBillingRate(rate) {
    if (rate == null || rate === '' || isNaN(rate)) return '';
    var n = Number(rate);
    if (!isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 0.0005) return Math.round(n);
    return Math.round(n * 100) / 100;
}

function applyBillingUtilitySurcharge(baseRate, utility) {
    var rate = Number(baseRate);
    if (!isFinite(rate)) return baseRate;
    var key = String(utility || '').trim();
    var surcharge = UTILITY_BILLING_SURCHARGE[key];
    if (surcharge == null || surcharge === 0) return formatBillingRate(rate);
    return formatBillingRate(rate * (1 + surcharge));
}

function getBaseBillingCodeAndRate(report) {
    var form = getReportForm(report);
    var phase = getReportPhase(report);
    var hasPt = hasPtVtInstalled(report);
    var ctCount = getCtCountForForm(form);

    if (ctCount === 0 || SELF_CONTAINED_FORMS.indexOf(form) !== -1) {
        return { code: 'SC', rate: BILLING_RATES.SC };
    }
    if (phase === '1') {
        if (form === '3S') {
            return hasPt
                ? { code: '1PhCTPT', rate: BILLING_RATES['1PhCTPT'] }
                : { code: '1PhCT', rate: BILLING_RATES['1PhCT'] };
        }
        if (['4S', '5S'].indexOf(form) !== -1) {
            return hasPt
                ? { code: '1Ph2CTPT', rate: BILLING_RATES['1Ph2CTPT'] }
                : { code: '1Ph2CT', rate: BILLING_RATES['1Ph2CT'] };
        }
    }
    if (phase === '3') {
        return hasPt
            ? { code: '3PhCTPT', rate: BILLING_RATES['3PhCTPT'] }
            : { code: '3PhCT', rate: BILLING_RATES['3PhCT'] };
    }
    return { code: 'SC', rate: BILLING_RATES.SC };
}

function getBillingCodeAndRate(report, utility) {
    var base = getBaseBillingCodeAndRate(report);
    return {
        code: base.code,
        rate: applyBillingUtilitySurcharge(base.rate, utility)
    };
}

/**
 * Per-CT multiplier: (CT ratio × PT/VT ratio × center-tap factor) / primary turns / double-pass divisor
 * 9S / 3-phase forms: average each CT's multiplier (not multiply CTs together).
 */
function computeSingleCtMultiplier(ct, report, ptFactor, ctIndex) {
    var idx = ctIndex == null ? 0 : ctIndex;
    var ratioLabel = getReportCtRatioLabel(report, idx);
    if (!ratioLabel) return null;
    var ctRatio = getCtRatioFactor(ratioLabel);
    var turns = Number(String((ct && ct.primary_turns) || '1').replace(/,/g, ''));
    var primaryTurns = turns > 0 ? turns : 1;
    var doublePassDiv = (ct && ct.double_pass === 'YES') ? 2 : 1;
    var centerTapMult = isCenterTapped(report) ? 2 : 1;
    var ptMult = ptFactor > 0 ? ptFactor : 1;
    return (ctRatio * ptMult * centerTapMult) / primaryTurns / doublePassDiv;
}

function computeCalculatedMultiplier(report) {
    if (!report) return '';
    var form = getReportForm(report);
    var ctCount = getCtCountForForm(form);
    if (ctCount === 0) return '';

    var ptFactor = getReportPtVtFactor(report);
    var perCt = [];
    for (var i = 0; i < ctCount; i++) {
        var ct = report.cts && report.cts[i];
        var m = computeSingleCtMultiplier(ct, report, ptFactor, i);
        if (m != null && isFinite(m) && m > 0) perCt.push(m);
    }
    if (!perCt.length) return '';

    var result;
    if (getReportPhase(report) === '3' || perCt.length > 1) {
        result = perCt.reduce(function(sum, n) { return sum + n; }, 0) / perCt.length;
    } else {
        result = perCt[0];
    }

    if (!isFinite(result) || result <= 0) return '';
    return formatCalculatedMultiplierValue(result);
}

function computeCalculatedMultiplierFormula(report) {
    if (!report) return '';
    var form = getReportForm(report);
    var ctCount = getCtCountForForm(form);
    if (ctCount === 0) return '';

    var ptFactor = getReportPtVtFactor(report);
    var ptRatioLabel = getReportPtVtRatioLabel(report);
    var centerTapMult = isCenterTapped(report) ? 2 : 1;
    var ctTerms = [];
    var ctValues = [];

    for (var i = 0; i < ctCount; i++) {
        var ct = report.cts && report.cts[i];
        var turns = Number(String((ct && ct.primary_turns) || '1').replace(/,/g, ''));
        var primaryTurns = turns > 0 ? turns : 1;
        var doublePassDiv = (ct && ct.double_pass === 'YES') ? 2 : 1;
        var value = computeSingleCtMultiplier(ct, report, ptFactor, i);
        if (value == null || !isFinite(value) || value <= 0) continue;
        ctValues.push(value);
        ctTerms.push(
            'CT' + (i + 1) + ':((' + describeCtRatioForFormula(getReportCtRatioLabel(report, i)) + ')×PT(' +
            describePtRatioForFormula(ptRatioLabel) + '=' + formatCalculatedMultiplierValue(ptFactor) +
            ')×CTap(' + centerTapMult + ')÷Turns(' + primaryTurns + ')÷DP(' + doublePassDiv + '))=' +
            formatCalculatedMultiplierValue(value)
        );
    }
    if (!ctValues.length) return '';

    var result = (getReportPhase(report) === '3' || ctValues.length > 1)
        ? ctValues.reduce(function(sum, n) { return sum + n; }, 0) / ctValues.length
        : ctValues[0];
    var resultStr = formatCalculatedMultiplierValue(result);
    if (getReportPhase(report) === '3' || ctValues.length > 1) {
        var sumExpr = ctValues.map(function(v) { return formatCalculatedMultiplierValue(v); }).join('+');
        return 'AVG((' + sumExpr + ')÷' + ctValues.length + ')=' + resultStr + ' | ' + ctTerms.join(' | ');
    }
    return ctTerms[0];
}

function computeMultiplierMatch(report) {
    var listedRaw = getListedMultiplier(report);
    var calculated = computeCalculatedMultiplier(report);
    if (!listedRaw || !calculated) return '';
    var listed = Number(String(listedRaw).replace(/,/g, ''));
    var calc = Number(calculated);
    if (isNaN(listed) || isNaN(calc)) return '';
    return Math.abs(listed - calc) < 0.01 ? 'YES' : 'NO';
}

function applyMultiplierCalculations(report) {
    if (!report) return report;
    report.calculated_multiplier = computeCalculatedMultiplier(report);
    report.calculated_multiplier_formula = computeCalculatedMultiplierFormula(report);
    report.multiplier_match = computeMultiplierMatch(report);
    return report;
}

// --- Calculated power factor (form-specific phase-angle rules) ---

function parseAngleDegrees(val) {
    if (val == null || val === '') return null;
    var n = Number(String(val).replace(/,/g, '').trim());
    return isNaN(n) ? null : n;
}

function normalizeAngleDegrees(deg) {
    var d = deg % 360;
    if (d < 0) d += 360;
    return d;
}

function pfCosineFromAngleDeg(angleDeg) {
    if (angleDeg == null || isNaN(angleDeg)) return null;
    return Math.cos(angleDeg * Math.PI / 180);
}

function pfCosine180Minus(angleDeg) {
    if (angleDeg == null || isNaN(angleDeg)) return null;
    return Math.cos((180 - angleDeg) * Math.PI / 180);
}

function getFirstPhaseAngle(report, keys) {
    for (var i = 0; i < keys.length; i++) {
        var a = parseAngleDegrees(report[keys[i]]);
        if (a != null) return a;
    }
    return null;
}

function isSixSMeterFamily(form) {
    return SIX_S_FAMILY.indexOf(normalizeMeterForm(form || '')) !== -1;
}

var FOUR_S_DISABLED_USAGE_FIELDS = [
    'primary_volts_cn', 'primary_volts_bc', 'primary_volts_ca',
    'secondary_volts_cn', 'secondary_volts_bc', 'secondary_volts_ca',
    'voltage_thd_cn', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_c', 'secondary_amps_c', 'current_thd_c',
    'ct_admittance_c_low', 'ct_admittance_c_high',
    'ct_reverse_rotation_c',
    'phase_angle_a_cn', 'phase_angle_a_bc', 'phase_angle_a_ca',
    'phase_angle_b_cn', 'phase_angle_b_bc', 'phase_angle_b_ca',
    'phase_angle_c_cn', 'phase_angle_c_an', 'phase_angle_c_bn',
    'phase_angle_c_ca', 'phase_angle_c_ab', 'phase_angle_c_bc'
];

var ALL_USAGE_LAYOUT_FIELD_KEYS = [
    'primary_volts_an', 'primary_volts_bn', 'primary_volts_cn', 'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca',
    'secondary_volts_an', 'secondary_volts_bn', 'secondary_volts_cn', 'secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca',
    'voltage_thd_an', 'voltage_thd_bn', 'voltage_thd_cn', 'voltage_thd_ab', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_a', 'primary_amps_b', 'primary_amps_c', 'secondary_amps_a', 'secondary_amps_b', 'secondary_amps_c',
    'current_thd_a', 'current_thd_b', 'current_thd_c',
    'ct_admittance_a_low', 'ct_admittance_a_high', 'ct_admittance_b_low', 'ct_admittance_b_high',
    'ct_admittance_c_low', 'ct_admittance_c_high',
    'ct_reverse_rotation_a', 'ct_reverse_rotation_b', 'ct_reverse_rotation_c',
    'phase_angle_a_an', 'phase_angle_a_bn', 'phase_angle_a_cn', 'phase_angle_a_ab', 'phase_angle_a_bc', 'phase_angle_a_ca',
    'phase_angle_b_bn', 'phase_angle_b_cn', 'phase_angle_b_an', 'phase_angle_b_bc', 'phase_angle_b_ca', 'phase_angle_b_ab',
    'phase_angle_c_cn', 'phase_angle_c_an', 'phase_angle_c_bn', 'phase_angle_c_ca', 'phase_angle_c_ab', 'phase_angle_c_bc'
];

var FIVE_S_3D_ENABLED_USAGE_FIELDS = [
    'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca',
    'secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca',
    'voltage_thd_ab', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_a', 'secondary_amps_a', 'current_thd_a',
    'primary_amps_c', 'secondary_amps_c', 'current_thd_c',
    'ct_admittance_a_low', 'ct_admittance_a_high',
    'ct_admittance_c_low', 'ct_admittance_c_high',
    'ct_reverse_rotation_a', 'ct_reverse_rotation_c',
    'phase_angle_a_ab', 'phase_angle_a_bc', 'phase_angle_a_ca',
    'phase_angle_c_ca', 'phase_angle_c_ab', 'phase_angle_c_bc'
];

var FIVE_S_4D_ENABLED_USAGE_FIELDS = [
    'primary_volts_an', 'primary_volts_bn', 'primary_volts_cn', 'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca',
    'secondary_volts_an', 'secondary_volts_bn', 'secondary_volts_cn', 'secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca',
    'voltage_thd_an', 'voltage_thd_bn', 'voltage_thd_cn', 'voltage_thd_ab', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_a', 'secondary_amps_a', 'current_thd_a',
    'primary_amps_c', 'secondary_amps_c', 'current_thd_c',
    'ct_admittance_a_low', 'ct_admittance_a_high',
    'ct_admittance_c_low', 'ct_admittance_c_high',
    'ct_reverse_rotation_a', 'ct_reverse_rotation_c',
    'phase_angle_a_an', 'phase_angle_a_bn', 'phase_angle_a_cn', 'phase_angle_a_ab',
    'phase_angle_c_cn', 'phase_angle_c_an', 'phase_angle_c_bn'
];

var FIVE_S_WYE_ENABLED_USAGE_FIELDS = FIVE_S_4D_ENABLED_USAGE_FIELDS.filter(function(k) {
    return k !== 'phase_angle_a_ab';
});

/** 5S usage layout variant from service description: 1ph | 3d | 4d | wye */
function getFiveSUsageVariant(report) {
    if (FIVE_S_FAMILY.indexOf(getReportForm(report)) === -1) return null;
    var desc = String((report && report.service_desc) || '').trim();
    if (desc === '1-phase with 2 CTs' || desc === '1-phase Primary') return '1ph';
    if (desc === '3-phase 3 Wire Delta') return '3d';
    if (desc === '3-phase 4 Wire Delta') return '4d';
    if (desc === '3-phase 4 Wire Wye' || desc === '3-phase Primary') return 'wye';
    if (getReportPhase(report) === '1') return '1ph';
    return '3d';
}

function getFiveSEnabledUsageFields(report) {
    var variant = getFiveSUsageVariant(report);
    if (!variant) return null;
    if (variant === '1ph') {
        return ALL_USAGE_LAYOUT_FIELD_KEYS.filter(function(k) {
            return FOUR_S_DISABLED_USAGE_FIELDS.indexOf(k) === -1;
        });
    }
    if (variant === '3d') return FIVE_S_3D_ENABLED_USAGE_FIELDS.slice();
    if (variant === '4d') return FIVE_S_4D_ENABLED_USAGE_FIELDS.slice();
    if (variant === 'wye') return FIVE_S_WYE_ENABLED_USAGE_FIELDS.slice();
    return null;
}

function isFiveSUsageLayoutForm(form) {
    return FIVE_S_FAMILY.indexOf(normalizeMeterForm(form || '')) !== -1;
}

function isFiveSFourWireDelta(report) {
    if (getReportPhase(report) !== '3') return false;
    if (FIVE_S_FAMILY.indexOf(getReportForm(report)) === -1) return false;
    var variant = getFiveSUsageVariant(report);
    return variant === '4d' || variant === 'wye';
}

function applyFiveSDisabledUsageFields(report) {
    if (!report || !isFiveSUsageLayoutForm(getReportForm(report))) return;
    var enabled = getFiveSEnabledUsageFields(report);
    if (!enabled) return;
    ALL_USAGE_LAYOUT_FIELD_KEYS.forEach(function(key) {
        if (enabled.indexOf(key) === -1) report[key] = '';
    });
}

function isSelfContainedMeterForm(form) {
    return SELF_CONTAINED_FORMS.indexOf(normalizeMeterForm(form || '')) !== -1;
}

function is16SUsageLayoutForm(form) {
    return normalizeMeterForm(form || '') === '16S';
}

function is12SUsageLayoutForm(form) {
    return normalizeMeterForm(form || '') === '12S';
}

/** 12S usage layout variant: 1ph | 3d */
function get12SUsageVariant(report) {
    if (getReportForm(report) !== '12S') return null;
    var desc = String((report && report.service_desc) || '').trim();
    if (desc.indexOf('1-phase') === 0) return '1ph';
    if (desc === '3-phase 3 Wire Delta') return '3d';
    if (getReportPhase(report) === '1') return '1ph';
    return '3d';
}

var SIXTEEN_S_ENABLED_USAGE_FIELDS = [
    'secondary_volts_an', 'secondary_volts_bn', 'secondary_volts_cn', 'secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca',
    'primary_volts_an', 'primary_volts_bn', 'primary_volts_cn', 'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca',
    'voltage_thd_an', 'voltage_thd_bn', 'voltage_thd_cn', 'voltage_thd_ab', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_a', 'primary_amps_b', 'primary_amps_c',
    'current_thd_a', 'current_thd_b', 'current_thd_c',
    'phase_angle_a_an', 'phase_angle_a_bn', 'phase_angle_a_cn',
    'phase_angle_b_bn', 'phase_angle_b_cn', 'phase_angle_b_an',
    'phase_angle_c_cn', 'phase_angle_c_an', 'phase_angle_c_bn'
];

var TWELVE_S_1PH_ENABLED_USAGE_FIELDS = [
    'secondary_volts_an', 'secondary_volts_bn', 'secondary_volts_ab',
    'primary_volts_an', 'primary_volts_bn', 'primary_volts_ab',
    'voltage_thd_an', 'voltage_thd_bn', 'voltage_thd_ab',
    'primary_amps_a', 'primary_amps_b',
    'current_thd_a', 'current_thd_b',
    'phase_angle_a_an', 'phase_angle_a_bn', 'phase_angle_a_ab',
    'phase_angle_b_bn', 'phase_angle_b_an', 'phase_angle_b_ab'
];

var TWELVE_S_3D_ENABLED_USAGE_FIELDS = [
    'secondary_volts_ab', 'secondary_volts_bc', 'secondary_volts_ca',
    'primary_volts_ab', 'primary_volts_bc', 'primary_volts_ca',
    'voltage_thd_ab', 'voltage_thd_bc', 'voltage_thd_ca',
    'primary_amps_a', 'primary_amps_c',
    'current_thd_a', 'current_thd_c',
    'phase_angle_a_ab', 'phase_angle_a_bc', 'phase_angle_a_ca',
    'phase_angle_c_ca', 'phase_angle_c_ab', 'phase_angle_c_bc'
];

function get12SEnabledUsageFields(report) {
    var variant = get12SUsageVariant(report);
    if (!variant) return null;
    if (variant === '1ph') return TWELVE_S_1PH_ENABLED_USAGE_FIELDS.slice();
    if (variant === '3d') return TWELVE_S_3D_ENABLED_USAGE_FIELDS.slice();
    return null;
}

function get16SEnabledUsageFields(report) {
    if (!is16SUsageLayoutForm(getReportForm(report))) return null;
    return SIXTEEN_S_ENABLED_USAGE_FIELDS.slice();
}

function getSelfContainedEnabledUsageFields(report) {
    var form = getReportForm(report);
    if (is16SUsageLayoutForm(form)) return get16SEnabledUsageFields(report);
    if (is12SUsageLayoutForm(form)) return get12SEnabledUsageFields(report);
    return null;
}

function applySelfContainedDisabledUsageFields(report) {
    if (!report || !isSelfContainedMeterForm(getReportForm(report))) return;
    var enabled = getSelfContainedEnabledUsageFields(report);
    if (!enabled) return;
    ALL_USAGE_LAYOUT_FIELD_KEYS.forEach(function(key) {
        if (enabled.indexOf(key) === -1) report[key] = '';
    });
}

function getSelfContainedPrimaryVoltMirrorPairs(report) {
    var enabled = getSelfContainedEnabledUsageFields(report);
    if (!enabled) return [];
    return USAGE_SECONDARY_PRIMARY_VOLT_PAIRS.filter(function(pair) {
        return enabled.indexOf(pair[0]) !== -1 && enabled.indexOf(pair[1]) !== -1;
    });
}

function applySelfContainedPrimaryVoltMirror(report) {
    if (!report || !isSelfContainedMeterForm(getReportForm(report))) return report;
    getSelfContainedPrimaryVoltMirrorPairs(report).forEach(function(pair) {
        var sec = String(report[pair[0]] || '').trim();
        if (sec) report[pair[1]] = sec;
    });
    return report;
}

function estimateSixSPhaseBAngle(report) {
    var direct = getFirstPhaseAngle(report, ['phase_angle_b_an', 'phase_angle_b_cn']);
    if (direct != null) return direct;
    var aAn = parseAngleDegrees(report.phase_angle_a_an);
    if (aAn != null) return normalizeAngleDegrees(aAn + 120);
    var cCn = parseAngleDegrees(report.phase_angle_c_cn);
    if (cCn != null) return normalizeAngleDegrees(cCn - 120);
    return null;
}

/**
 * Form-specific calculated power factor from usage phase angles.
 * Returns per-phase PF (a/b/c) and arithmetic average of active phases.
 */
function getCalculatedPowerFactors(report) {
    var result = { a: null, b: null, c: null, average: null, activePhases: [] };
    if (!report) return result;

    var form = getReportForm(report);
    var phase = getReportPhase(report);

    function setPf(phaseKey, angleDeg, transform) {
        if (angleDeg == null) return;
        var pf = transform === '180minus' ? pfCosine180Minus(angleDeg) : pfCosineFromAngleDeg(angleDeg);
        if (pf == null || !isFinite(pf)) return;
        result[phaseKey] = pf;
        if (result.activePhases.indexOf(phaseKey) === -1) result.activePhases.push(phaseKey);
    }

    if (form === '3S') {
        if (hasPtVtInstalled(report)) {
            setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_an']), 'direct');
        } else {
            setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
        }
    } else if (form === '4S') {
        setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
        setPf('b', getFirstPhaseAngle(report, ['phase_angle_b_ab']), '180minus');
    } else if (FIVE_S_FAMILY.indexOf(form) !== -1) {
        var fiveSVariant = getFiveSUsageVariant(report);
        if (phase === '1' || fiveSVariant === '1ph') {
            setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
            setPf('b', getFirstPhaseAngle(report, ['phase_angle_b_ab']), '180minus');
        } else if (phase === '3') {
            if (fiveSVariant === '4d') {
                setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
                setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_cn']), 'direct');
            } else if (fiveSVariant === 'wye') {
                setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_an']), 'direct');
                setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_cn']), 'direct');
            } else {
                setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
                setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_bc']), '180minus');
            }
        }
    } else if (NINE_S_FAMILY.indexOf(form) !== -1) {
        setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_an']), 'direct');
        setPf('b', getFirstPhaseAngle(report, ['phase_angle_b_bn']), 'direct');
        setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_cn']), 'direct');
    } else if (isSixSMeterFamily(form)) {
        setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_an', 'phase_angle_a_cn']), 'direct');
        setPf('b', estimateSixSPhaseBAngle(report), 'direct');
        setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_cn', 'phase_angle_c_an']), 'direct');
    } else if (form === '16S') {
        setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_an']), 'direct');
        setPf('b', getFirstPhaseAngle(report, ['phase_angle_b_bn']), 'direct');
        setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_cn']), 'direct');
    } else if (form === '12S') {
        var twelveVariant = get12SUsageVariant(report);
        if (twelveVariant === '1ph') {
            setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
            setPf('b', getFirstPhaseAngle(report, ['phase_angle_b_ab']), '180minus');
        } else if (twelveVariant === '3d') {
            setPf('a', getFirstPhaseAngle(report, ['phase_angle_a_ab']), 'direct');
            setPf('c', getFirstPhaseAngle(report, ['phase_angle_c_bc']), '180minus');
        }
    }

    var pfs = result.activePhases.map(function(k) { return result[k]; }).filter(function(v) {
        return v != null && isFinite(v);
    });
    if (pfs.length) {
        result.average = pfs.reduce(function(sum, v) { return sum + v; }, 0) / pfs.length;
    }
    return result;
}

function formatCalcPfDisplay(val) {
    if (val == null || val === '' || isNaN(val) || !isFinite(val)) return '—';
    return Number(val).toFixed(3);
}

/** UI tier for calculated PF outline: good >0.8, warn 0.6–0.8, bad <0.6. */
function getCalcPfOutlineTier(pf) {
    if (pf == null || pf === '' || isNaN(pf) || !isFinite(pf)) return 'neutral';
    if (pf > 0.8) return 'good';
    if (pf >= 0.6) return 'warn';
    return 'bad';
}

/** CT burden % drop entry → % accurate for graph (100 − drop). */
function calcBurdenPctRemainingFromDrop(dropVal) {
    var drop = Number(String(dropVal == null ? '' : dropVal).replace(/,/g, ''));
    if (isNaN(drop) || !isFinite(drop)) return null;
    return 100 - drop;
}

function formatCalcPfExport(val) {
    if (val == null || val === '' || isNaN(val) || !isFinite(val)) return '';
    return String(Math.round(Number(val) * 10000) / 10000);
}

function parseUsageMagnitude(val) {
    var n = parseFloat(String(val || '').replace(/,/g, '').trim());
    if (!isFinite(n) || n <= 0) return null;
    return n;
}

function firstUsageValue(report, keys) {
    for (var i = 0; i < keys.length; i++) {
        var v = parseUsageMagnitude(report[keys[i]]);
        if (v != null) return v;
    }
    return null;
}

var NINE_S_VECTOR_VISUAL_V = 100;
var NINE_S_VECTOR_VISUAL_I = 75;

/** Standard phase colors — voltage (potential) and current (line). */
var WSAPP_PHASE_VOLTAGE_COLORS = { A: '#dc2626', B: '#eab308', C: '#2563eb' };
var WSAPP_PHASE_CURRENT_COLORS = { A: '#000000', B: '#ea580c', C: '#16a34a' };

/** 4-wire wye when secondary L-N volts present; else 4-wire delta from secondary line-line volts. */
function detectNineSServiceLayout(report) {
    if (!report) return 'wye';
    if (firstUsageValue(report, ['secondary_volts_an']) &&
        firstUsageValue(report, ['secondary_volts_bn']) &&
        firstUsageValue(report, ['secondary_volts_cn'])) {
        return 'wye';
    }
    if (firstUsageValue(report, ['secondary_volts_ab']) ||
        firstUsageValue(report, ['secondary_volts_bc']) ||
        firstUsageValue(report, ['secondary_volts_ca'])) {
        return 'delta';
    }
    return 'wye';
}

function formatVectorActualNumber(val, decimals) {
    if (val == null || !isFinite(val)) return '—';
    return Number(val).toFixed(decimals == null ? 2 : decimals);
}

/**
 * 9S phasors for vector diagram. Phase angles = current lag vs that phase L-N (or line-line on delta).
 */
function buildNineSVectorPhasors(report) {
    if (!report || !isNineSWyeForm(getReportForm(report))) return null;

    var layout = detectNineSServiceLayout(report);
    var pfData = getCalculatedPowerFactors(report);
    var layoutCfg = layout === 'delta' ? {
        v: {
            a: ['secondary_volts_ab'],
            b: ['secondary_volts_bc'],
            c: ['secondary_volts_ca']
        },
        vBase: { a: 0, b: -120, c: 120 },
        vLabel: { a: 'V A-B', b: 'V B-C', c: 'V C-A' }
    } : {
        v: {
            a: ['secondary_volts_an'],
            b: ['secondary_volts_bn'],
            c: ['secondary_volts_cn']
        },
        vBase: { a: 0, b: -120, c: 120 },
        vLabel: { a: 'V A-N', b: 'V B-N', c: 'V C-N' }
    };
    var angleKeys = {
        a: ['phase_angle_a_an'],
        b: ['phase_angle_b_bn'],
        c: ['phase_angle_c_cn']
    };
    var ampKeys = {
        a: ['secondary_amps_a'],
        b: ['secondary_amps_b'],
        c: ['secondary_amps_c']
    };

    var phasors = [];
    ['a', 'b', 'c'].forEach(function(ph) {
        var lag = getFirstPhaseAngle(report, angleKeys[ph]);
        var vDeg = layoutCfg.vBase[ph];
        var vActual = firstUsageValue(report, layoutCfg.v[ph]);
        var iActual = firstUsageValue(report, ampKeys[ph]);
        phasors.push({
            phase: ph.toUpperCase(),
            vMagActual: vActual,
            vDeg: vDeg,
            vLabel: layoutCfg.vLabel[ph],
            iMagActual: iActual,
            iDeg: lag != null ? vDeg - lag : null,
            lagDeg: lag,
            pf: pfData[ph]
        });
    });

    return { layout: layout, phasors: phasors, pf: pfData };
}

function polarToSvgXY(mag, deg, cx, cy, scale) {
    var rad = deg * Math.PI / 180;
    return {
        x: cx + mag * scale * Math.cos(rad),
        y: cy - mag * scale * Math.sin(rad)
    };
}

function renderNineSVectorDiagramSvg(report, opts) {
    opts = opts || {};
    var w = opts.width || 560;
    var h = opts.height || 400;
    var diagramW = 390;
    var data = buildNineSVectorPhasors(report);
    if (!data) {
        return '<div class="text-xs text-slate-500 text-center py-6">Vector diagram is available for 9S only.</div>';
    }

    var hasAny = data.phasors.some(function(p) {
        return p.vMagActual != null || p.iMagActual != null || p.lagDeg != null;
    });
    if (!hasAny) {
        return '<div class="text-xs text-slate-500 text-center py-6">Enter secondary volts, secondary amps, and phase angles on Usage Data.</div>';
    }

    var cx = diagramW / 2;
    var cy = h / 2 + 8;
    var vColors = WSAPP_PHASE_VOLTAGE_COLORS;
    var iColors = WSAPP_PHASE_CURRENT_COLORS;
    var parts = [];
    var svgId = opts.svgId || 'wsapp-vector-svg';

    parts.push('<svg id="' + svgId + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="9S vector diagram">');
    parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>');
    parts.push('<defs>');
    parts.push('<marker id="wsapp-v-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/></marker>');
    parts.push('<marker id="wsapp-i-arrow" markerWidth="7" markerHeight="7" refX="6" refY="2.5" orient="auto"><path d="M0,0 L6,2.5 L0,5 Z" fill="currentColor"/></marker>');
    parts.push('</defs>');
    parts.push('<text x="' + (diagramW / 2) + '" y="16" text-anchor="middle" font-size="11" fill="#475569" font-weight="600">' +
        (data.layout === 'wye' ? '4-Wire Wye' : '4-Wire Delta') + ' — fixed scale V=' + NINE_S_VECTOR_VISUAL_V + ' · I=' + NINE_S_VECTOR_VISUAL_I + '</text>');
    parts.push('<line x1="' + cx + '" y1="30" x2="' + cx + '" y2="' + (h - 24) + '" stroke="#e2e8f0" stroke-width="1"/>');
    parts.push('<line x1="28" y1="' + cy + '" x2="' + (diagramW - 28) + '" y2="' + cy + '" stroke="#e2e8f0" stroke-width="1"/>');

    data.phasors.forEach(function(p) {
        var vCol = vColors[p.phase] || '#334155';
        var iCol = iColors[p.phase] || '#334155';
        if (p.vMagActual != null) {
            var vEnd = polarToSvgXY(NINE_S_VECTOR_VISUAL_V, p.vDeg, cx, cy, 1);
            parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + vEnd.x.toFixed(1) + '" y2="' + vEnd.y.toFixed(1) +
                '" stroke="' + vCol + '" stroke-width="3" color="' + vCol + '" marker-end="url(#wsapp-v-arrow)"/>');
            parts.push('<text x="' + (vEnd.x + 4).toFixed(1) + '" y="' + (vEnd.y - 4).toFixed(1) +
                '" font-size="10" fill="' + vCol + '" font-weight="600">' + p.vLabel + '</text>');
        }
        if (p.iMagActual != null && p.iDeg != null) {
            var iEnd = polarToSvgXY(NINE_S_VECTOR_VISUAL_I, p.iDeg, cx, cy, 1);
            parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + iEnd.x.toFixed(1) + '" y2="' + iEnd.y.toFixed(1) +
                '" stroke="' + iCol + '" stroke-width="2.5" stroke-dasharray="6,4" color="' + iCol + '" marker-end="url(#wsapp-i-arrow)"/>');
            parts.push('<text x="' + (iEnd.x + 4).toFixed(1) + '" y="' + (iEnd.y + 12).toFixed(1) +
                '" font-size="10" fill="' + iCol + '">I ' + p.phase + '</text>');
        }
    });

    parts.push('<text x="24" y="' + (h - 8) + '" font-size="9" fill="#64748b">Solid = voltage · Dashed = current (lagging)</text>');

    var panelX = diagramW + 12;
    parts.push('<rect x="' + panelX + '" y="28" width="' + (w - panelX - 10) + '" height="' + (h - 40) + '" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>');
    parts.push('<text x="' + (panelX + 10) + '" y="46" font-size="10" fill="#334155" font-weight="700">Secondary (actual)</text>');
    var rowY = 64;
    data.phasors.forEach(function(p) {
        var col = vColors[p.phase] || '#334155';
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="10" fill="' + col + '" font-weight="700">' + p.phase + ' Phase</text>');
        rowY += 14;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">' + p.vLabel + ': ' + formatVectorActualNumber(p.vMagActual, 1) + ' V</text>');
        rowY += 12;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">I ' + p.phase + ': ' + formatVectorActualNumber(p.iMagActual, 3) + ' A</text>');
        rowY += 12;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">∠ lag: ' + (p.lagDeg != null ? formatVectorActualNumber(p.lagDeg, 1) + '°' : '—') + '</text>');
        rowY += 12;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="10" fill="#334155" font-weight="700">PF: ' + formatCalcPfDisplay(p.pf) + '</text>');
        rowY += 18;
    });

    parts.push('</svg>');
    return parts.join('');
}

function supportsVectorDiagram(report) {
    if (!report) return false;
    var form = getReportForm(report);
    return isNineSWyeForm(form) || form === '3S' || form === '4S';
}

function build3SVectorPhasors(report) {
    if (!report || getReportForm(report) !== '3S') return null;

    var withPt = hasPtVtInstalled(report);
    var pfData = getCalculatedPowerFactors(report);
    var lag = getFirstPhaseAngle(report, withPt ? ['phase_angle_a_an'] : ['phase_angle_a_ab']);
    var vActual = firstUsageValue(report, withPt ? ['secondary_volts_an'] : ['secondary_volts_ab']);
    var iActual = firstUsageValue(report, ['secondary_amps_a']);

    return {
        title: withPt ? '3S with PT' : '3S without PT',
        layout: withPt ? '3s-pt' : '3s-no-pt',
        phasors: [{
            phase: 'A',
            vMagActual: vActual,
            vDeg: 0,
            vLabel: withPt ? 'V A-N' : 'V A-B',
            iMagActual: iActual,
            iDeg: lag != null ? -lag : null,
            lagDeg: lag,
            pf: pfData.a
        }],
        pf: pfData
    };
}

function build4SVectorPhasors(report) {
    if (!report || getReportForm(report) !== '4S') return null;

    var pfData = getCalculatedPowerFactors(report);
    var vActual = firstUsageValue(report, ['secondary_volts_ab']);
    var lagA = getFirstPhaseAngle(report, ['phase_angle_a_ab']);
    var lagB = getFirstPhaseAngle(report, ['phase_angle_b_ab']);
    var iA = firstUsageValue(report, ['secondary_amps_a']);
    var iB = firstUsageValue(report, ['secondary_amps_b']);

    return {
        title: '4S',
        layout: '4s',
        sharedVoltage: {
            vMagActual: vActual,
            vDeg: 0,
            vLabel: 'V A-B'
        },
        refVoltage: {
            vDeg: 180,
            vLabel: 'V A-B−180°'
        },
        phasors: [
            {
                phase: 'A',
                iMagActual: iA,
                iDeg: lagA != null ? -lagA : null,
                lagDeg: lagA,
                pf: pfData.a,
                pfHint: 'cos(I A vs A-B)'
            },
            {
                phase: 'B',
                iMagActual: iB,
                iDeg: lagB != null ? -lagB : null,
                lagDeg: lagB,
                pf: pfData.b,
                pfHint: 'cos(I B vs A-B−180°)'
            }
        ],
        pf: pfData
    };
}

function buildVectorPhasors(report) {
    if (!report) return null;
    var form = getReportForm(report);
    if (isNineSWyeForm(form)) return buildNineSVectorPhasors(report);
    if (form === '3S') return build3SVectorPhasors(report);
    if (form === '4S') return build4SVectorPhasors(report);
    return null;
}

function renderBasicVectorDiagramSvg(data, opts) {
    opts = opts || {};
    var w = opts.width || 560;
    var h = opts.height || 400;
    var diagramW = 390;
    var cx = diagramW / 2;
    var cy = h / 2 + 8;
    var vColors = WSAPP_PHASE_VOLTAGE_COLORS;
    var iColors = WSAPP_PHASE_CURRENT_COLORS;
    var parts = [];
    var svgId = opts.svgId || 'wsapp-vector-svg';
    var scaleV = NINE_S_VECTOR_VISUAL_V;
    var scaleI = NINE_S_VECTOR_VISUAL_I;

    parts.push('<svg id="' + svgId + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + data.title + ' vector diagram">');
    parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>');
    parts.push('<defs>');
    parts.push('<marker id="wsapp-v-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="currentColor"/></marker>');
    parts.push('<marker id="wsapp-i-arrow" markerWidth="7" markerHeight="7" refX="6" refY="2.5" orient="auto"><path d="M0,0 L6,2.5 L0,5 Z" fill="currentColor"/></marker>');
    parts.push('</defs>');
    parts.push('<text x="' + (diagramW / 2) + '" y="16" text-anchor="middle" font-size="11" fill="#475569" font-weight="600">' +
        data.title + ' — fixed scale V=' + scaleV + ' · I=' + scaleI + '</text>');
    parts.push('<line x1="' + cx + '" y1="30" x2="' + cx + '" y2="' + (h - 24) + '" stroke="#e2e8f0" stroke-width="1"/>');
    parts.push('<line x1="28" y1="' + cy + '" x2="' + (diagramW - 28) + '" y2="' + cy + '" stroke="#e2e8f0" stroke-width="1"/>');

    if (data.sharedVoltage && data.sharedVoltage.vMagActual != null) {
        var sv = data.sharedVoltage;
        var vColShared = vColors.A || '#dc2626';
        var vEndShared = polarToSvgXY(scaleV, sv.vDeg, cx, cy, 1);
        parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + vEndShared.x.toFixed(1) + '" y2="' + vEndShared.y.toFixed(1) +
            '" stroke="' + vColShared + '" stroke-width="3" color="' + vColShared + '" marker-end="url(#wsapp-v-arrow)"/>');
        parts.push('<text x="' + (vEndShared.x + 4).toFixed(1) + '" y="' + (vEndShared.y - 4).toFixed(1) +
            '" font-size="10" fill="' + vColShared + '" font-weight="600">' + sv.vLabel + '</text>');
    }
    if (data.refVoltage) {
        var refEnd = polarToSvgXY(scaleV, data.refVoltage.vDeg, cx, cy, 1);
        parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + refEnd.x.toFixed(1) + '" y2="' + refEnd.y.toFixed(1) +
            '" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,4"/>');
        parts.push('<text x="' + (refEnd.x + 4).toFixed(1) + '" y="' + (refEnd.y - 4).toFixed(1) +
            '" font-size="9" fill="#64748b">' + data.refVoltage.vLabel + '</text>');
    }

    (data.phasors || []).forEach(function(p) {
        var vCol = vColors[p.phase] || '#334155';
        var iCol = iColors[p.phase] || '#334155';
        if (!data.sharedVoltage && p.vMagActual != null) {
            var vEnd = polarToSvgXY(scaleV, p.vDeg, cx, cy, 1);
            parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + vEnd.x.toFixed(1) + '" y2="' + vEnd.y.toFixed(1) +
                '" stroke="' + vCol + '" stroke-width="3" color="' + vCol + '" marker-end="url(#wsapp-v-arrow)"/>');
            parts.push('<text x="' + (vEnd.x + 4).toFixed(1) + '" y="' + (vEnd.y - 4).toFixed(1) +
                '" font-size="10" fill="' + vCol + '" font-weight="600">' + p.vLabel + '</text>');
        }
        if (p.iMagActual != null && p.iDeg != null) {
            var iEnd = polarToSvgXY(scaleI, p.iDeg, cx, cy, 1);
            parts.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + iEnd.x.toFixed(1) + '" y2="' + iEnd.y.toFixed(1) +
                '" stroke="' + iCol + '" stroke-width="2.5" stroke-dasharray="6,4" color="' + iCol + '" marker-end="url(#wsapp-i-arrow)"/>');
            parts.push('<text x="' + (iEnd.x + 4).toFixed(1) + '" y="' + (iEnd.y + 12).toFixed(1) +
                '" font-size="10" fill="' + iCol + '">I ' + p.phase + '</text>');
        }
    });

    parts.push('<text x="24" y="' + (h - 8) + '" font-size="9" fill="#64748b">Solid = voltage · Dashed = current (lagging)</text>');

    var panelX = diagramW + 12;
    parts.push('<rect x="' + panelX + '" y="28" width="' + (w - panelX - 10) + '" height="' + (h - 40) + '" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>');
    parts.push('<text x="' + (panelX + 10) + '" y="46" font-size="10" fill="#334155" font-weight="700">Secondary (actual)</text>');
    var rowY = 64;
    if (data.sharedVoltage) {
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">' + data.sharedVoltage.vLabel + ': ' +
            formatVectorActualNumber(data.sharedVoltage.vMagActual, 1) + ' V</text>');
        rowY += 16;
    }
    (data.phasors || []).forEach(function(p) {
        var col = vColors[p.phase] || '#334155';
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="10" fill="' + col + '" font-weight="700">' + p.phase + ' Phase</text>');
        rowY += 14;
        if (!data.sharedVoltage && p.vLabel) {
            parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">' + p.vLabel + ': ' + formatVectorActualNumber(p.vMagActual, 1) + ' V</text>');
            rowY += 12;
        }
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">I ' + p.phase + ': ' + formatVectorActualNumber(p.iMagActual, 3) + ' A</text>');
        rowY += 12;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="9" fill="#475569">∠ lag: ' + (p.lagDeg != null ? formatVectorActualNumber(p.lagDeg, 1) + '°' : '—') + '</text>');
        rowY += 12;
        parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="10" fill="#334155" font-weight="700">PF: ' + formatCalcPfDisplay(p.pf) + '</text>');
        if (p.pfHint) {
            rowY += 11;
            parts.push('<text x="' + (panelX + 10) + '" y="' + rowY + '" font-size="8" fill="#64748b">' + p.pfHint + '</text>');
        }
        rowY += 18;
    });

    parts.push('</svg>');
    return parts.join('');
}

function render3SVectorDiagramSvg(report, opts) {
    var data = build3SVectorPhasors(report);
    if (!data) {
        return '<div class="text-xs text-slate-500 text-center py-6">Vector diagram is available for 3S only.</div>';
    }
    var hasAny = data.phasors.some(function(p) {
        return p.vMagActual != null || p.iMagActual != null || p.lagDeg != null;
    });
    if (!hasAny) {
        return '<div class="text-xs text-slate-500 text-center py-6">Enter secondary volts, secondary amps, and phase angle on Usage Data.</div>';
    }
    return renderBasicVectorDiagramSvg(data, opts);
}

function render4SVectorDiagramSvg(report, opts) {
    var data = build4SVectorPhasors(report);
    if (!data) {
        return '<div class="text-xs text-slate-500 text-center py-6">Vector diagram is available for 4S only.</div>';
    }
    var hasAny = (data.sharedVoltage && data.sharedVoltage.vMagActual != null) ||
        data.phasors.some(function(p) { return p.iMagActual != null || p.lagDeg != null; });
    if (!hasAny) {
        return '<div class="text-xs text-slate-500 text-center py-6">Enter secondary A-B volts, secondary amps, and phase angles on Usage Data.</div>';
    }
    return renderBasicVectorDiagramSvg(data, opts);
}

function renderVectorDiagramSvg(report, opts) {
    if (!report) {
        return '<div class="text-xs text-slate-500 text-center py-6">No field report data.</div>';
    }
    var form = getReportForm(report);
    if (isNineSWyeForm(form)) return renderNineSVectorDiagramSvg(report, opts);
    if (form === '3S') return render3SVectorDiagramSvg(report, opts);
    if (form === '4S') return render4SVectorDiagramSvg(report, opts);
    return '<div class="text-xs text-slate-500 text-center py-6">Vector diagram is available for 3S, 4S, and 9S only.</div>';
}

// --- Timed revolution kW ---

function getTimedRevMultiplier(report) {
    if (!report) return NaN;
    applyMultiplierCalculations(report);
    var listed = getListedMultiplier(report);
    if (listed) return Number(String(listed).replace(/,/g, ''));
    if (report.calculated_multiplier) return Number(String(report.calculated_multiplier).replace(/,/g, ''));
    return NaN;
}

/** kW: ((3600×mult×Kh)/(1000×sec))/avg calculated PF */
function computeTimedRevKw(seconds, report) {
    var sec = Number(String(seconds == null ? '' : seconds).replace(/,/g, '').trim());
    if (!sec || sec <= 0 || isNaN(sec)) return null;
    var mult = getTimedRevMultiplier(report);
    var kh = Number(String((report && report.kh) || '').replace(/,/g, '').trim());
    if (!mult || isNaN(mult) || !kh || isNaN(kh)) return null;
    var pfData = getCalculatedPowerFactors(report);
    if (!pfData.average || pfData.average <= 0 || !isFinite(pfData.average)) return null;
    var kw = ((3600 * mult * kh) / (1000 * sec)) / pfData.average;
    return isFinite(kw) && kw > 0 ? kw : null;
}

/** kW on meter page: (3600 × listed mult × Kh) / (1000 × seconds) — no PF factor. */
function computeTimedRevKwSimple(seconds, report) {
    var sec = Number(String(seconds == null ? '' : seconds).replace(/,/g, '').trim());
    if (!sec || sec <= 0 || isNaN(sec)) return null;
    var listed = getListedMultiplier(report);
    var mult = Number(String(listed || '').replace(/,/g, '').trim());
    if (!listed || isNaN(mult)) return null;
    var kh = Number(String((report && report.kh) || '').replace(/,/g, '').trim());
    if (!kh || isNaN(kh)) return null;
    var kw = (3600 * mult * kh) / (1000 * sec);
    return isFinite(kw) && kw > 0 ? kw : null;
}

function formatTimedRevKwDisplay(kw) {
    if (kw == null || isNaN(kw) || !isFinite(kw)) return '—';
    return Number(kw).toFixed(3);
}

function formatTimedRevKwExport(kw) {
    if (kw == null || isNaN(kw) || !isFinite(kw)) return '';
    return String(Math.round(Number(kw) * 1000) / 1000);
}

// --- CT / PT burden chart math ---

var LEGACY_BURDEN_OHMS_MAP = [
    { ohms: '0.0', suffix: '_0' },
    { ohms: '0.1', suffix: '_01' },
    { ohms: '0.2', suffix: '_02' },
    { ohms: '0.5', suffix: '_05' },
    { ohms: '1.0', suffix: '_1' },
    { ohms: '2.0', suffix: '_2' },
    { ohms: '4.0', suffix: '_4' }
];
var LEGACY_BURDEN_PHASE_KEYS = ['a', 'b', 'c'];

function ensureCtBurdenGrid(ct) {
    if (!ct) return;
    if (!ct.burden) ct.burden = {};
    BURDEN_OHMS_LIST.forEach(function(o) {
        if (!ct.burden[o]) {
            ct.burden[o] = { pri: '', sec: '', drop: o === '0.0' ? '' : '0' };
        }
    });
}

/** Copy legacy flat burden_a_* / burden_b_* / burden_c_* fields into ct.burden when nested data is empty. */
function migrateLegacyCtBurdenFields(report) {
    if (!report) return report;
    var hasLegacy = LEGACY_BURDEN_PHASE_KEYS.some(function(ph) {
        return LEGACY_BURDEN_OHMS_MAP.some(function(m) {
            return String(report['burden_' + ph + '_pri' + m.suffix] || '').trim() ||
                String(report['burden_' + ph + '_sec' + m.suffix] || '').trim() ||
                String(report['burden_' + ph + '_drop' + m.suffix] || '').trim();
        });
    });
    if (!hasLegacy) return report;
    if (!report.cts) report.cts = [];
    LEGACY_BURDEN_PHASE_KEYS.forEach(function(ph, idx) {
        if (!report.cts[idx]) return;
        var ct = report.cts[idx];
        ensureCtBurdenGrid(ct);
        LEGACY_BURDEN_OHMS_MAP.forEach(function(m) {
            var pri = report['burden_' + ph + '_pri' + m.suffix];
            var sec = report['burden_' + ph + '_sec' + m.suffix];
            var drop = report['burden_' + ph + '_drop' + m.suffix];
            var existing = ct.burden[m.ohms] || { pri: '', sec: '', drop: '' };
            var hasNested = String(existing.pri || '').trim() || String(existing.sec || '').trim() ||
                (m.ohms !== '0.0' && String(existing.drop || '').trim() && existing.drop !== '0');
            if (!hasNested && (String(pri || '').trim() || String(sec || '').trim() || String(drop || '').trim())) {
                ct.burden[m.ohms] = {
                    pri: pri != null ? String(pri) : '',
                    sec: sec != null ? String(sec) : '',
                    drop: drop != null ? String(drop) : (m.ohms === '0.0' ? '' : '0')
                };
            }
        });
    });
    return report;
}

function prepareReportForCtBurdenCharts(report) {
    if (!report) return report;
    migrateLegacyCtBurdenFields(report);
    (report.cts || []).forEach(function(ct) {
        ensureCtBurdenGrid(ct);
    });
    return report;
}

function burdenRowHasCurrentReading(row) {
    return !!(String((row && row.pri) || '').trim() || String((row && row.sec) || '').trim());
}

/** Resolve % drop for charting — 0 Ω is implicitly 0% when pri/sec exist; explicit 0 is valid. */
function resolveBurdenRowDropValue(row, ohms) {
    if (!row || !burdenRowHasCurrentReading(row)) return null;
    var drop = String(row.drop == null ? '' : row.drop).trim();
    if (drop === '') {
        return ohms === '0.0' ? '0' : null;
    }
    return drop;
}

function burdenRowHasDropReading(row, ohms) {
    var drop = resolveBurdenRowDropValue(row, ohms);
    if (drop == null) return false;
    var n = Number(String(drop).replace(/,/g, ''));
    return isFinite(n);
}

function getCtBurdenNameplateRatio(ratioSize) {
    var np = parseCtRatioNameplate(ratioSize);
    return np > 0 ? np : null;
}

function calcBurdenRatioErrorPct(calcRatio, nameplateRatio) {
    if (calcRatio == null || !nameplateRatio) return null;
    return ((calcRatio - nameplateRatio) / nameplateRatio) * 100;
}

function describeCtBurdenChartEmpty(report, metric) {
    if (!report || !(report.cts || []).length) {
        return 'No CTs on this service. Add CT blocks on CT Data first.';
    }
    prepareReportForCtBurdenCharts(report);
    var missingRatio = false;
    var missingReadings = true;
    var missingClass = false;
    var missingRated = false;
    (report.cts || []).forEach(function(ct) {
        if (!getCtBurdenNameplateRatio(ct.ratio_size)) missingRatio = true;
        if (metric === 'parallelogram') {
            if (!parseCtAccuracyClassPct(ct.accuracy_class)) missingClass = true;
            if (parseCtBurdenRatingOhms(ct.burden_rating) == null) missingRated = true;
        }
        if (ct.burden) {
            BURDEN_OHMS_LIST.forEach(function(ohms) {
                var row = ct.burden[ohms];
                if (metric === 'drop') {
                    if (burdenRowHasDropReading(row, ohms)) missingReadings = false;
                } else if (burdenRowHasCurrentReading(row)) {
                    missingReadings = false;
                }
            });
        }
    });
    var parts = [];
    if (missingRatio) parts.push('enter <strong>CT ratio</strong> on CT Data');
    if (metric === 'parallelogram' && missingClass) parts.push('enter <strong>Accuracy Class</strong> on CT Data');
    if (metric === 'parallelogram' && missingRated) parts.push('enter <strong>Burden Rating</strong> on CT Data');
    if (missingReadings) {
        if (metric === 'drop') parts.push('enter <strong>% Drop</strong> readings on CT Burden Data');
        else parts.push('enter <strong>Primary I</strong> and <strong>Secondary I</strong> on CT Burden Data');
    }
    return parts.length
        ? parts.join('; ') + '.'
        : 'No plottable CT burden points yet.';
}

function calcBurdenCtRatio(pri, sec) {
    var p = Number(String(pri == null ? '' : pri).replace(/,/g, ''));
    var s = Number(String(sec == null ? '' : sec).replace(/,/g, ''));
    if (!s || isNaN(p) || isNaN(s) || s === 0) return null;
    return (p / s) * 5;
}

function calcBurdenPctAccurate(calcRatio, nameplateRatio) {
    if (calcRatio == null || !nameplateRatio) return null;
    return 100 - Math.abs((calcRatio - nameplateRatio) / nameplateRatio * 100);
}

function formatBurdenCalcDisplay(val) {
    if (val == null || isNaN(val)) return '—';
    return Number(val).toFixed(1);
}

function calcPtBurdenRatio(priV, secV, ratioSize) {
    var p = Number(String(priV == null ? '' : priV).replace(/,/g, ''));
    var s = Number(String(secV == null ? '' : secV).replace(/,/g, ''));
    if (!s || isNaN(p) || isNaN(s) || s === 0) return null;
    var parts = parsePtRatioParts(ratioSize);
    if (parts.primary && parts.secondary) return (p / s) * parts.secondary;
    return (p / s) * (parts.secondary || 120);
}

function calcPtBurdenPctAccurate(calcRatio, ratioSize) {
    if (calcRatio == null) return null;
    var parts = parsePtRatioParts(ratioSize);
    var nameplate = parts.primary;
    if (!nameplate || nameplate === 120 && !String(ratioSize || '').trim()) return null;
    return 100 - Math.abs((calcRatio - nameplate) / nameplate * 100);
}

/** Parse PT burden rating (VA) from PT Data screen. */
function parsePtBurdenRatingVa(val) {
    var n = parseFloat(String(val || '').replace(/,/g, '').trim());
    return isFinite(n) && n >= 0 ? n : null;
}

function resolveBurdenPhaseLetter(phaseField, fallbackIndex) {
    var s = String(phaseField || '').trim();
    var m = s.match(/\b([ABC])\b/i) || s.match(/([ABC])/i);
    if (m) return m[1].toUpperCase();
    return ['A', 'B', 'C'][fallbackIndex] || '';
}

/** Rated burden (Ω) from CT Data; if missing, infer highest burden step with readings. */
function resolveCtRatedBurdenOhms(ct) {
    if (!ct) return null;
    var rated = parseCtBurdenRatingOhms(ct.burden_rating);
    if (rated != null) return rated;
    ensureCtBurdenGrid(ct);
    var maxOhm = null;
    BURDEN_OHMS_LIST.forEach(function(ohms) {
        var row = ct.burden && ct.burden[ohms];
        if (!row || !burdenRowHasCurrentReading(row)) return;
        var o = parseFloat(ohms);
        if (maxOhm == null || o > maxOhm) maxOhm = o;
    });
    return maxOhm;
}

function getCtBurdenOhmsUpToRating(ratedOhms) {
    if (ratedOhms == null || !isFinite(ratedOhms)) return [];
    return BURDEN_OHMS_LIST.filter(function(ohms) {
        return parseFloat(ohms) <= ratedOhms + 0.001;
    });
}

function getPtVaStepsUpToRating(ratedVa) {
    if (ratedVa == null || !isFinite(ratedVa)) return PT_BURDEN_VA_LIST.slice();
    return PT_BURDEN_VA_LIST.filter(function(va) {
        return parseFloat(va) <= ratedVa + 0.001;
    });
}

function weightedAveragePct(samples) {
    if (!samples || !samples.length) return null;
    var sumW = 0;
    var sumV = 0;
    samples.forEach(function(s) {
        sumW += s.weight;
        sumV += s.value * s.weight;
    });
    return sumW > 0 ? sumV / sumW : null;
}

function getInstrumentAccuracyErrorPct(pctAccurate) {
    if (pctAccurate == null || !isFinite(pctAccurate)) return null;
    return Math.max(0, 100 - pctAccurate);
}

/**
 * Field burden acceptance envelope (matches burden-table yellow/red bands and accuracy tiers).
 * ±4% ratio error at 0 Ω → ±2% at rated burden — not nameplate accuracy class (e.g. C0.3 = ±0.3%).
 * CT primary-current transducer adds +1% each way on non-weighted CT methods and graphs only.
 */
var CT_FIELD_RATIO_ERR_AT_RATED_PCT = 2;
var CT_FIELD_RATIO_ERR_AT_ZERO_PCT = 4;
var CT_PRIMARY_TRANSDUCER_MARGIN_PCT = 1;
var PT_FIELD_RATIO_ERR_AT_RATED_PCT = 2;
var PT_FIELD_RATIO_ERR_AT_ZERO_PCT = 4;

function withCtTransducerMargin(limitPct) {
    if (limitPct == null || !isFinite(limitPct)) return limitPct;
    return limitPct + CT_PRIMARY_TRANSDUCER_MARGIN_PCT;
}

function applyCtTransducerMarginToPctAccurate(pctAccurate) {
    if (pctAccurate == null || !isFinite(pctAccurate)) return null;
    return Math.min(100, pctAccurate + CT_PRIMARY_TRANSDUCER_MARGIN_PCT);
}

function ctFieldBurdenErrorBoundsAtBurden(burdenOhms, ratedBurdenOhms, useCtTransducerMargin) {
    var margin = useCtTransducerMargin !== false ? CT_PRIMARY_TRANSDUCER_MARGIN_PCT : 0;
    var errRated = CT_FIELD_RATIO_ERR_AT_RATED_PCT + margin;
    var errZero = CT_FIELD_RATIO_ERR_AT_ZERO_PCT + margin;
    var rated = ratedBurdenOhms > 0 ? ratedBurdenOhms : 0;
    var x = burdenOhms;
    if (rated <= 0) {
        return { top: errRated, bottom: -errRated };
    }
    if (x > rated) {
        return { top: errRated, bottom: -errRated };
    }
    var t = x / rated;
    var top = errZero - t * (errZero - errRated);
    return { top: top, bottom: -top };
}

function isPointInsideFieldBurdenTrapezoid(burdenOhms, ratioErrorPct, ratedBurdenOhms, useCtTransducerMargin) {
    if (ratioErrorPct == null || !isFinite(ratioErrorPct) || ratedBurdenOhms == null) return null;
    if (burdenOhms > ratedBurdenOhms + 0.001) return null;
    var b = ctFieldBurdenErrorBoundsAtBurden(burdenOhms, ratedBurdenOhms, useCtTransducerMargin);
    return ratioErrorPct >= b.bottom && ratioErrorPct <= b.top;
}

/** CT/PT accuracy tier: ok (≤2% error), warn (2–4%), bad (>4%). */
function getInstrumentAccuracyTier(pctAccurate) {
    var err = getInstrumentAccuracyErrorPct(pctAccurate);
    if (err == null) return 'empty';
    if (err > 4) return 'bad';
    if (err > 2) return 'warn';
    return 'ok';
}

function formatInstrumentAccuracyDisplay(pctAccurate, decimals) {
    decimals = decimals == null ? 1 : decimals;
    if (pctAccurate == null || !isFinite(pctAccurate)) return '—';
    return pctAccurate.toFixed(decimals) + '%';
}

/** Burden test samples up to CT rated burden (shared by all CT accuracy methods). */
function collectCtBurdenAccuracySamples(ct) {
    if (!ct) return [];
    ensureCtBurdenGrid(ct);
    var rated = resolveCtRatedBurdenOhms(ct);
    var ohmsSteps = getCtBurdenOhmsUpToRating(rated);
    var nameplate = getCtBurdenNameplateRatio(ct.ratio_size);
    if (!nameplate) return [];
    var accClass = parseCtAccuracyClassPct(ct.accuracy_class);
    var samples = [];
    ohmsSteps.forEach(function(ohms) {
        var row = ct.burden && ct.burden[ohms];
        if (!row || !burdenRowHasCurrentReading(row)) return;
        var calc = calcBurdenCtRatio(row.pri, row.sec);
        var pct = calcBurdenPctAccurate(calc, nameplate);
        if (pct == null || !isFinite(pct)) return;
        var ratioError = calcBurdenRatioErrorPct(calc, nameplate);
        var burden = parseFloat(ohms);
        var insideClass = (accClass != null && rated != null && ratioError != null)
            ? isPointInsideCtParallelogram(burden, ratioError, accClass, rated)
            : null;
        var insideField = (rated != null && ratioError != null)
            ? isPointInsideFieldBurdenTrapezoid(burden, ratioError, rated, true)
            : null;
        var allowedClassErr = (accClass != null && rated != null)
            ? ctParallelogramErrorBoundsAtBurden(burden, accClass, rated).top
            : null;
        var allowedClassErrMargin = allowedClassErr != null ? withCtTransducerMargin(allowedClassErr) : null;
        var allowedFieldErr = rated != null
            ? ctFieldBurdenErrorBoundsAtBurden(burden, rated, true).top
            : null;
        var insideClassMargin = (allowedClassErrMargin != null && ratioError != null && rated != null)
            ? (burden <= rated + 0.001 && Math.abs(ratioError) <= allowedClassErrMargin)
            : null;
        samples.push({
            ohms: ohms,
            burden: burden,
            pctAccurate: pct,
            ratioError: ratioError,
            dropPct: getBurdenRowDropPct(row),
            inside: insideClass,
            insideClass: insideClass,
            insideClassMargin: insideClassMargin,
            insideField: insideField,
            allowedError: allowedClassErr,
            allowedErrorMargin: allowedClassErrMargin,
            allowedFieldError: allowedFieldErr
        });
    });
    return samples;
}

function computeCtWeightedAccuracy(ct) {
    var samples = collectCtBurdenAccuracySamples(ct);
    if (!samples.length) return null;
    var weighted = samples.map(function(s) {
        return { value: s.pctAccurate, weight: s.ohms === '0.0' ? 2 : 1 };
    });
    return weightedAveragePct(weighted);
}

/** Field burden trapezoid: % of steps ≤ rated burden inside ±4%→±2% field envelope. */
function computeCtBurdenTrapezoidInSpecPct(ct) {
    var samples = collectCtBurdenAccuracySamples(ct);
    var scored = samples.filter(function(s) { return s.insideField !== null; });
    if (!scored.length) return null;
    var inside = scored.filter(function(s) { return s.insideField; }).length;
    return (inside / scored.length) * 100;
}

function formatCtBurdenTrapezoidDisplay(ct, value) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectCtBurdenAccuracySamples(ct);
    var scored = samples.filter(function(s) { return s.insideField !== null; });
    if (!scored.length) return value.toFixed(0) + '%';
    var inside = scored.filter(function(s) { return s.insideField; }).length;
    return value.toFixed(0) + '% (' + inside + '/' + scored.length + ' pts)';
}

function getCtBurdenTrapezoidMethodTier(ct, value) {
    if (value == null || !isFinite(value)) return 'empty';
    if (value >= 100) return 'ok';
    if (value >= 80) return 'warn';
    return 'bad';
}

/** Back-compat aliases — burden trapezoid replaced the old misnamed “parallelogram” scorer. */
var computeCtParallelogramInSpecPct = computeCtBurdenTrapezoidInSpecPct;
var formatCtParallelogramMethodDisplay = formatCtBurdenTrapezoidDisplay;
var getCtParallelogramMethodTier = getCtBurdenTrapezoidMethodTier;

/** Burden-table % drop → phase error (minutes) for TCF; ~21′ per 1% drop (classic wattmeter CT test). */
var CT_DROP_TO_PHASE_MINUTES = 21;

function getBurdenRowDropPct(row) {
    if (!row) return 0;
    var drop = String(row.drop || '').trim();
    if (!drop || drop === '0') return 0;
    var n = parseFloat(drop.replace(/,/g, ''));
    return isFinite(n) ? n : 0;
}

function estimateCtPhaseErrorMinutesFromDrop(dropPct) {
    if (dropPct == null || !isFinite(dropPct) || dropPct === 0) return 0;
    return Math.abs(dropPct) * CT_DROP_TO_PHASE_MINUTES;
}

function resolveCtPhaseErrorMinutesForBurdenTest(ct, burdenRow) {
    var explicit = getCtPhaseAngleErrorMinutes(ct);
    if (explicit != null) return explicit;
    return estimateCtPhaseErrorMinutesFromDrop(getBurdenRowDropPct(burdenRow));
}

/**
 * IEEE C57.13 TCF error % at unity PF: TCF = RCF − β/2600 (β in minutes).
 * Percent form: ratioErr% − (β/2600)×100.
 */
function computeCtTcfErrorPct(ratioErrPct, phaseErrorMin) {
    if (ratioErrPct == null || !isFinite(ratioErrPct)) return null;
    var beta = phaseErrorMin == null || !isFinite(phaseErrorMin) ? 0 : phaseErrorMin;
    return ratioErrPct - (beta / 2600) * 100;
}

function getCtTcfFieldLimitPct(useCtTransducerMargin) {
    var margin = useCtTransducerMargin !== false ? CT_PRIMARY_TRANSDUCER_MARGIN_PCT : 0;
    return CT_FIELD_RATIO_ERR_AT_RATED_PCT + margin;
}

function scoreCtTcfFieldMargin(tcfErrPct, limitPct) {
    if (tcfErrPct == null || !isFinite(tcfErrPct) || limitPct == null || limitPct <= 0) return null;
    if (Math.abs(tcfErrPct) <= limitPct) return 100;
    return Math.max(0, 100 - ((Math.abs(tcfErrPct) - limitPct) / limitPct) * 100);
}

/** IEEE C57.13 phase limit (minutes) scales with accuracy class; 15′ at class 0.3. */
function getIeeeC5713PhaseLimitMinutes(accuracyClass) {
    if (accuracyClass == null || !isFinite(accuracyClass) || accuracyClass <= 0) return null;
    return 15 * (accuracyClass / 0.3);
}

/**
 * IEEE C57.13 ratio–phase parallelogram (ratio correction % vs CT phase error in minutes).
 * phaseErrorMin: CT intrinsic phase displacement error — NOT service V-I angle from Usage Data.
 */
function isInsideIeeeC5713RatioPhaseParallelogram(ratioErrPct, phaseErrorMin, accuracyClass) {
    if (ratioErrPct == null || !isFinite(ratioErrPct) || accuracyClass == null) return null;
    var betaMin = phaseErrorMin == null || !isFinite(phaseErrorMin) ? 0 : Math.abs(phaseErrorMin);
    var phaseLimit = getIeeeC5713PhaseLimitMinutes(accuracyClass);
    if (phaseLimit == null || phaseLimit <= 0) return Math.abs(ratioErrPct) <= accuracyClass;
    var ratioLimit = accuracyClass * Math.max(0, 1 - betaMin / phaseLimit);
    return Math.abs(ratioErrPct) <= ratioLimit;
}

/** CT phase error (minutes) — reserved for future CT test input; not Usage Data service angle. */
function getCtPhaseAngleErrorMinutes(ct) {
    if (!ct) return null;
    var raw = String(ct.phase_angle_error_min || ct.ct_phase_error_min || '').trim();
    if (!raw) return null;
    var n = parseFloat(raw.replace(/,/g, ''));
    return isFinite(n) ? n : null;
}

function pickCtBurdenSampleForIeeeTest(samples, ratedOhms) {
    if (!samples.length) return null;
    if (ratedOhms != null) {
        for (var i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i].burden - ratedOhms) < 0.001) return samples[i];
        }
    }
    return samples[samples.length - 1];
}

/** IEEE TCF field score (0–100) from ratio + burden % drop phase estimate at rated burden. */
function computeCtIeeeRatioPhaseScore(ct, report, ctIndex) {
    var acc = parseCtAccuracyClassPct(ct.accuracy_class);
    if (!acc) return null;
    var samples = collectCtBurdenAccuracySamples(ct);
    if (!samples.length) return null;
    var rated = resolveCtRatedBurdenOhms(ct);
    var sample = pickCtBurdenSampleForIeeeTest(samples, rated);
    if (!sample || sample.ratioError == null) return null;
    ensureCtBurdenGrid(ct);
    var row = ct.burden && ct.burden[sample.ohms];
    var phaseErrMin = resolveCtPhaseErrorMinutesForBurdenTest(ct, row);
    var tcfErr = computeCtTcfErrorPct(sample.ratioError, phaseErrMin);
    return scoreCtTcfFieldMargin(tcfErr, getCtTcfFieldLimitPct());
}

function formatCtIeeeRatioPhaseDisplay(ct, value, report, ctIndex) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectCtBurdenAccuracySamples(ct);
    var rated = resolveCtRatedBurdenOhms(ct);
    var sample = pickCtBurdenSampleForIeeeTest(samples, rated);
    ensureCtBurdenGrid(ct);
    var row = sample && ct.burden ? ct.burden[sample.ohms] : null;
    var phaseErrMin = resolveCtPhaseErrorMinutesForBurdenTest(ct, row);
    var tcfErr = sample ? computeCtTcfErrorPct(sample.ratioError, phaseErrMin) : null;
    var phaseTag = getCtPhaseAngleErrorMinutes(ct) != null ? '' : (getBurdenRowDropPct(row) ? 'est ' : '');
    var tcfStr = tcfErr != null
        ? (tcfErr >= 0 ? '+' : '') + tcfErr.toFixed(2) + '% TCF'
        : '—';
    return value.toFixed(1) + '% (' + tcfStr + ', φ' + phaseTag + phaseErrMin.toFixed(0) + '′)';
}

function getCtIeeeRatioPhaseMethodTier(ct, value, report, ctIndex) {
    if (value == null || !isFinite(value)) return 'empty';
    if (value >= 99.5) return 'ok';
    if (value >= 90) return 'warn';
    return 'bad';
}

function computeCtWorstPointAccuracy(ct) {
    var samples = collectCtBurdenAccuracySamples(ct);
    if (!samples.length) return null;
    var min = applyCtTransducerMarginToPctAccurate(samples[0].pctAccurate);
    samples.forEach(function(s) {
        var adj = applyCtTransducerMarginToPctAccurate(s.pctAccurate);
        if (adj != null && adj < min) min = adj;
    });
    return min;
}

function computeCtRmsCurveAccuracy(ct) {
    var samples = collectCtBurdenAccuracySamples(ct);
    if (!samples.length) return null;
    var sq = 0;
    samples.forEach(function(s) {
        var adj = applyCtTransducerMarginToPctAccurate(s.pctAccurate);
        var err = adj == null ? 0 : 100 - adj;
        sq += err * err;
    });
    return 100 - Math.sqrt(sq / samples.length);
}

function scoreMarginToClassBandLimit(ratioErrPct, allowedErrPct) {
    if (ratioErrPct == null || allowedErrPct == null || !isFinite(ratioErrPct) || allowedErrPct <= 0) return null;
    var abs = Math.abs(ratioErrPct);
    if (abs <= allowedErrPct) return 100;
    return Math.max(0, 100 - ((abs - allowedErrPct) / allowedErrPct) * 100);
}

function computeCtClassBandScore(ct) {
    var samples = collectCtBurdenAccuracySamples(ct);
    var scored = samples.filter(function(s) {
        return s.allowedErrorMargin != null && s.ratioError != null && s.allowedErrorMargin > 0;
    });
    if (!scored.length) return null;
    var pointScores = scored.map(function(s) {
        return scoreMarginToClassBandLimit(s.ratioError, s.allowedErrorMargin);
    }).filter(function(v) { return v != null; });
    if (!pointScores.length) return null;
    return pointScores.reduce(function(a, b) { return a + b; }, 0) / pointScores.length;
}

function formatCtClassBandDisplay(ct, value) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectCtBurdenAccuracySamples(ct);
    var scored = samples.filter(function(s) {
        return s.insideClassMargin !== null;
    });
    if (!scored.length) return value.toFixed(1) + '%';
    var inside = scored.filter(function(s) { return s.insideClassMargin; }).length;
    return value.toFixed(1) + '% (' + inside + '/' + scored.length + ' in C+' + CT_PRIMARY_TRANSDUCER_MARGIN_PCT + '%)';
}

function getCtClassBandMethodTier(ct, value) {
    var samples = collectCtBurdenAccuracySamples(ct);
    var scored = samples.filter(function(s) {
        return s.allowedErrorMargin != null && s.ratioError != null && s.allowedErrorMargin > 0;
    });
    if (!scored.length) {
        if (value == null || !isFinite(value)) return 'empty';
        if (value >= 99.5) return 'ok';
        if (value >= 80) return 'warn';
        return 'bad';
    }
    var worstRatio = 0;
    scored.forEach(function(s) {
        var r = Math.abs(s.ratioError) / s.allowedErrorMargin;
        if (r > worstRatio) worstRatio = r;
    });
    if (worstRatio <= 1) return 'ok';
    if (worstRatio <= 1.5) return 'warn';
    return 'bad';
}

function formatCtMethodAverageDisplay(methodDef, average) {
    if (average == null || !isFinite(average)) return '—';
    if (methodDef && (methodDef.id === 'burden_trapezoid' || methodDef.id === 'parallelogram')) {
        return average.toFixed(0) + '%';
    }
    if (methodDef && (methodDef.id === 'ieee_ratio_phase' || methodDef.id === 'class_bands')) {
        return average.toFixed(1) + '%';
    }
    return formatInstrumentAccuracyDisplay(average);
}

var CT_ACCURACY_METHOD_DEFS = [
    {
        id: 'weighted_burden',
        label: 'Weighted Burden Avg',
        description: 'Weighted average of % accurate up to rated burden (0 Ω counted twice).',
        compute: computeCtWeightedAccuracy,
        formatDisplay: function(ct, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(ct, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(ct, value) { return getInstrumentAccuracyTier(value); }
    },
    {
        id: 'burden_trapezoid',
        label: 'Burden Ratio Trapezoid',
        description: 'Percent of burden steps ≤ rated burden inside the field envelope (±5% at 0 Ω → ±3% at rated, includes +1% primary transducer margin).',
        compute: computeCtBurdenTrapezoidInSpecPct,
        formatDisplay: formatCtBurdenTrapezoidDisplay,
        tierFn: getCtBurdenTrapezoidMethodTier,
        averageTierFn: getCtBurdenTrapezoidMethodTier
    },
    {
        id: 'ieee_ratio_phase',
        label: 'IEEE TCF (Ratio+Drop)',
        description: 'IEEE C57.13 TCF at rated burden (ratio + % drop phase estimate). Scored vs ±3% field limit (+1% primary transducer margin).',
        needsReport: true,
        compute: computeCtIeeeRatioPhaseScore,
        formatDisplay: formatCtIeeeRatioPhaseDisplay,
        tierFn: getCtIeeeRatioPhaseMethodTier,
        averageTierFn: function(ct, value) { return getCtIeeeRatioPhaseMethodTier(ct, value); }
    },
    {
        id: 'worst_point',
        label: 'Worst-Point Min',
        description: 'Lowest % accurate at any burden step up to rated burden (+1% primary transducer margin).',
        compute: computeCtWorstPointAccuracy,
        formatDisplay: function(ct, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(ct, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(value) { return getInstrumentAccuracyTier(value); }
    },
    {
        id: 'rms_curve',
        label: 'RMS Curve Score',
        description: '100 minus the RMS of ratio errors across burden steps (+1% primary transducer margin).',
        compute: computeCtRmsCurveAccuracy,
        formatDisplay: function(ct, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(ct, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(value) { return getInstrumentAccuracyTier(value); }
    },
];

function computeCtAccuracyForMethod(ct, methodDef, report, ctIndex) {
    if (!ct || !methodDef) return null;
    var value = methodDef.needsReport
        ? methodDef.compute(ct, report, ctIndex)
        : methodDef.compute(ct);
    if (value == null || !isFinite(value)) return null;
    var tier = methodDef.needsReport
        ? methodDef.tierFn(ct, value, report, ctIndex)
        : methodDef.tierFn(ct, value);
    var display = methodDef.needsReport
        ? methodDef.formatDisplay(ct, value, report, ctIndex)
        : methodDef.formatDisplay(ct, value);
    return {
        value: value,
        tier: tier,
        display: display
    };
}

function computeCtAccuracyMethodsComparison(report) {
    prepareReportForCtBurdenCharts(report);
    var ctCount = getCtCountForForm(getReportForm(report));
    var cts = (report && report.cts) || [];
    var methods = CT_ACCURACY_METHOD_DEFS.map(function(def) {
        var phases = [];
        for (var i = 0; i < ctCount && i < cts.length; i++) {
            var ct = cts[i];
            if (!ct || !instrumentHasBurdenTestData(ct)) continue;
            var result = computeCtAccuracyForMethod(ct, def, report, i);
            if (!result) continue;
            phases.push({
                phase: resolveBurdenPhaseLetter(ct.burden_phase, i),
                value: result.value,
                tier: result.tier,
                display: result.display,
                ctIndex: i
            });
        }
        var values = phases.map(function(p) { return p.value; });
        var average = values.length
            ? values.reduce(function(a, b) { return a + b; }, 0) / values.length
            : null;
        var avgTierFn = def.averageTierFn || def.tierFn;
        return {
            id: def.id,
            label: def.label,
            description: def.description,
            phases: phases,
            average: average,
            averageTier: avgTierFn(null, average),
            averageDisplay: formatCtMethodAverageDisplay(def, average),
            hasData: phases.length > 0
        };
    });
    return {
        methods: methods,
        hasData: methods.some(function(m) { return m.hasData; })
    };
}

function computePtWeightedAccuracy(pt) {
    if (!pt || !pt.va_burden) return null;
    var rated = parsePtBurdenRatingVa(pt.burden_rating);
    var vaSteps = getPtVaStepsUpToRating(rated);
    var samples = [];
    vaSteps.forEach(function(va) {
        var row = pt.va_burden[va];
        if (!row) return;
        if (!String(row.pri_v || '').trim() && !String(row.sec_v || '').trim()) return;
        var calc = calcPtBurdenRatio(row.pri_v, row.sec_v, pt.ratio_size);
        var pct = calcPtBurdenPctAccurate(calc, pt.ratio_size);
        if (pct == null || !isFinite(pct)) return;
        samples.push({ value: pct, weight: va === '0' ? 2 : 1 });
    });
    return weightedAveragePct(samples);
}

function instrumentHasBurdenTestData(item) {
    if (!item) return false;
    return !!(String(item.ratio_size || '').trim() || String(item.mfg || '').trim() ||
        String(item.serial_number || '').trim());
}

function computeCtAccuracyBreakdown(report) {
    prepareReportForCtBurdenCharts(report);
    var ctCount = getCtCountForForm(getReportForm(report));
    var phases = [];
    var cts = (report && report.cts) || [];
    for (var i = 0; i < ctCount && i < cts.length; i++) {
        var ct = cts[i];
        if (!ct || !instrumentHasBurdenTestData(ct)) continue;
        var pct = computeCtWeightedAccuracy(ct);
        if (pct == null) continue;
        phases.push({
            phase: resolveBurdenPhaseLetter(ct.burden_phase, i),
            label: ct.burden_phase || ('Phase ' + resolveBurdenPhaseLetter(ct.burden_phase, i)),
            value: pct,
            tier: getInstrumentAccuracyTier(pct),
            ctIndex: i
        });
    }
    var values = phases.map(function(p) { return p.value; });
    var average = values.length
        ? values.reduce(function(a, b) { return a + b; }, 0) / values.length
        : null;
    return {
        phases: phases,
        average: average,
        averageTier: getInstrumentAccuracyTier(average),
        hasData: phases.length > 0
    };
}

function computePtAccuracyBreakdown(report) {
    var phases = [];
    var pts = (report && report.pts) || [];
    for (var i = 0; i < pts.length && i < 3; i++) {
        var pt = pts[i];
        if (!pt || !instrumentHasBurdenTestData(pt)) continue;
        var pct = computePtWeightedAccuracy(pt);
        if (pct == null) continue;
        phases.push({
            phase: resolveBurdenPhaseLetter(pt.va_burden_phase, i),
            label: pt.va_burden_phase || ('Phase ' + resolveBurdenPhaseLetter(pt.va_burden_phase, i)),
            value: pct,
            tier: getInstrumentAccuracyTier(pct),
            ptIndex: i
        });
    }
    var values = phases.map(function(p) { return p.value; });
    var average = values.length
        ? values.reduce(function(a, b) { return a + b; }, 0) / values.length
        : null;
    return {
        phases: phases,
        average: average,
        averageTier: getInstrumentAccuracyTier(average),
        hasData: phases.length > 0
    };
}

var parsePtAccuracyClassPct = parseCtAccuracyClassPct;

function calcPtBurdenRatioErrorPct(calcRatio, ratioSize) {
    if (calcRatio == null) return null;
    var parts = parsePtRatioParts(ratioSize);
    var nameplate = parts.primary;
    if (!nameplate) return null;
    return ((calcRatio - nameplate) / nameplate) * 100;
}

function resolvePtRatedBurdenVa(pt) {
    if (!pt) return null;
    var rated = parsePtBurdenRatingVa(pt.burden_rating);
    if (rated != null) return rated;
    if (!pt.va_burden) return null;
    var maxVa = null;
    PT_BURDEN_VA_LIST.forEach(function(va) {
        var row = pt.va_burden[va];
        if (!row || (!String(row.pri_v || '').trim() && !String(row.sec_v || '').trim())) return;
        var v = parseFloat(va);
        if (maxVa == null || v > maxVa) maxVa = v;
    });
    return maxVa;
}

function ptFieldBurdenErrorBoundsAtVa(va, ratedVa) {
    var errRated = PT_FIELD_RATIO_ERR_AT_RATED_PCT;
    var errZero = PT_FIELD_RATIO_ERR_AT_ZERO_PCT;
    var rated = ratedVa > 0 ? ratedVa : 0;
    var x = va;
    if (rated <= 0) {
        return { top: errRated, bottom: -errRated };
    }
    if (x > rated) {
        return { top: errRated, bottom: -errRated };
    }
    var t = x / rated;
    var top = errZero - t * (errZero - errRated);
    return { top: top, bottom: -top };
}

function ptParallelogramErrorBoundsAtVa(va, accuracyPct, ratedVa) {
    var acc = accuracyPct;
    var rated = ratedVa > 0 ? ratedVa : 0;
    var x = va;
    if (rated <= 0) {
        return { top: acc, bottom: -acc };
    }
    if (x > rated) {
        return { top: acc, bottom: -acc };
    }
    var t = x / rated;
    return {
        top: (2 * acc) - t * acc,
        bottom: -(2 * acc) + t * acc
    };
}

function collectPtBurdenAccuracySamples(pt) {
    if (!pt || !pt.va_burden) return [];
    var rated = resolvePtRatedBurdenVa(pt);
    var vaSteps = getPtVaStepsUpToRating(rated);
    var accClass = parsePtAccuracyClassPct(pt.accuracy_class);
    var samples = [];
    vaSteps.forEach(function(va) {
        var row = pt.va_burden[va];
        if (!row || (!String(row.pri_v || '').trim() && !String(row.sec_v || '').trim())) return;
        var calc = calcPtBurdenRatio(row.pri_v, row.sec_v, pt.ratio_size);
        var pct = calcPtBurdenPctAccurate(calc, pt.ratio_size);
        if (pct == null || !isFinite(pct)) return;
        var ratioError = calcPtBurdenRatioErrorPct(calc, pt.ratio_size);
        var burdenVa = parseFloat(va);
        var allowedClassErr = (accClass != null && rated != null)
            ? ptParallelogramErrorBoundsAtVa(burdenVa, accClass, rated).top
            : null;
        var insideField = (rated != null && ratioError != null)
            ? (burdenVa <= rated + 0.001 && Math.abs(ratioError) <= ptFieldBurdenErrorBoundsAtVa(burdenVa, rated).top)
            : null;
        var insideClassMargin = (allowedClassErr != null && ratioError != null && rated != null)
            ? (burdenVa <= rated + 0.001 && Math.abs(ratioError) <= allowedClassErr)
            : null;
        samples.push({
            va: va,
            burdenVa: burdenVa,
            pctAccurate: pct,
            ratioError: ratioError,
            dropPct: getBurdenRowDropPct(row),
            insideClassMargin: insideClassMargin,
            insideField: insideField,
            allowedError: allowedClassErr,
            allowedErrorMargin: allowedClassErr
        });
    });
    return samples;
}

function pickPtBurdenSampleForTcfTest(samples, ratedVa) {
    if (!samples.length) return null;
    if (ratedVa != null) {
        for (var i = 0; i < samples.length; i++) {
            if (Math.abs(samples[i].burdenVa - ratedVa) < 0.001) return samples[i];
        }
    }
    return samples[samples.length - 1];
}

function computePtBurdenTrapezoidInSpecPct(pt) {
    var samples = collectPtBurdenAccuracySamples(pt);
    var scored = samples.filter(function(s) { return s.insideField !== null; });
    if (!scored.length) return null;
    var inside = scored.filter(function(s) { return s.insideField; }).length;
    return (inside / scored.length) * 100;
}

function formatPtBurdenTrapezoidDisplay(pt, value) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectPtBurdenAccuracySamples(pt);
    var scored = samples.filter(function(s) { return s.insideField !== null; });
    if (!scored.length) return value.toFixed(0) + '%';
    var inside = scored.filter(function(s) { return s.insideField; }).length;
    return value.toFixed(0) + '% (' + inside + '/' + scored.length + ' pts)';
}

function getPtBurdenTrapezoidMethodTier(pt, value) {
    if (value == null || !isFinite(value)) return 'empty';
    if (value >= 100) return 'ok';
    if (value >= 80) return 'warn';
    return 'bad';
}

function computePtTcfScore(pt) {
    var acc = parsePtAccuracyClassPct(pt.accuracy_class);
    if (!acc) return null;
    var samples = collectPtBurdenAccuracySamples(pt);
    if (!samples.length) return null;
    var rated = resolvePtRatedBurdenVa(pt);
    var sample = pickPtBurdenSampleForTcfTest(samples, rated);
    if (!sample || sample.ratioError == null) return null;
    var row = pt.va_burden && pt.va_burden[sample.va];
    var phaseErrMin = resolveCtPhaseErrorMinutesForBurdenTest(pt, row);
    var tcfErr = computeCtTcfErrorPct(sample.ratioError, phaseErrMin);
    return scoreCtTcfFieldMargin(tcfErr, PT_FIELD_RATIO_ERR_AT_RATED_PCT);
}

function formatPtTcfDisplay(pt, value) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectPtBurdenAccuracySamples(pt);
    var rated = resolvePtRatedBurdenVa(pt);
    var sample = pickPtBurdenSampleForTcfTest(samples, rated);
    var row = sample && pt.va_burden ? pt.va_burden[sample.va] : null;
    var phaseErrMin = resolveCtPhaseErrorMinutesForBurdenTest(pt, row);
    var tcfErr = sample ? computeCtTcfErrorPct(sample.ratioError, phaseErrMin) : null;
    var tcfStr = tcfErr != null ? (tcfErr >= 0 ? '+' : '') + tcfErr.toFixed(2) + '% TCF' : '—';
    return value.toFixed(1) + '% (' + tcfStr + ', φ' + phaseErrMin.toFixed(0) + '′)';
}

function getPtTcfMethodTier(pt, value) {
    if (value == null || !isFinite(value)) return 'empty';
    if (value >= 99.5) return 'ok';
    if (value >= 90) return 'warn';
    return 'bad';
}

function computePtWorstPointAccuracy(pt) {
    var samples = collectPtBurdenAccuracySamples(pt);
    if (!samples.length) return null;
    var min = samples[0].pctAccurate;
    samples.forEach(function(s) {
        if (s.pctAccurate < min) min = s.pctAccurate;
    });
    return min;
}

function computePtRmsCurveAccuracy(pt) {
    var samples = collectPtBurdenAccuracySamples(pt);
    if (!samples.length) return null;
    var sq = 0;
    samples.forEach(function(s) {
        var err = 100 - s.pctAccurate;
        sq += err * err;
    });
    return 100 - Math.sqrt(sq / samples.length);
}

function computePtClassBandScore(pt) {
    var samples = collectPtBurdenAccuracySamples(pt);
    var scored = samples.filter(function(s) {
        return s.allowedErrorMargin != null && s.ratioError != null && s.allowedErrorMargin > 0;
    });
    if (!scored.length) return null;
    var pointScores = scored.map(function(s) {
        return scoreMarginToClassBandLimit(s.ratioError, s.allowedErrorMargin);
    }).filter(function(v) { return v != null; });
    if (!pointScores.length) return null;
    return pointScores.reduce(function(a, b) { return a + b; }, 0) / pointScores.length;
}

function formatPtClassBandDisplay(pt, value) {
    if (value == null || !isFinite(value)) return '—';
    var samples = collectPtBurdenAccuracySamples(pt);
    var scored = samples.filter(function(s) { return s.insideClassMargin !== null; });
    if (!scored.length) return value.toFixed(1) + '%';
    var inside = scored.filter(function(s) { return s.insideClassMargin; }).length;
    return value.toFixed(1) + '% (' + inside + '/' + scored.length + ' in class)';
}

function getPtClassBandMethodTier(pt, value) {
    return getCtClassBandMethodTier(pt, value);
}

function formatPtMethodAverageDisplay(methodDef, average) {
    if (average == null || !isFinite(average)) return '—';
    if (methodDef && methodDef.id === 'burden_trapezoid') {
        return average.toFixed(0) + '%';
    }
    if (methodDef && methodDef.id === 'tcf') {
        return average.toFixed(1) + '%';
    }
    return formatInstrumentAccuracyDisplay(average);
}

var PT_ACCURACY_METHOD_DEFS = [
    {
        id: 'weighted_burden',
        label: 'Weighted Burden Avg',
        description: 'Weighted average of % accurate up to rated VA burden (0 VA counted twice).',
        compute: computePtWeightedAccuracy,
        formatDisplay: function(pt, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(pt, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(pt, value) { return getInstrumentAccuracyTier(value); }
    },
    {
        id: 'burden_trapezoid',
        label: 'Burden Ratio Trapezoid',
        description: 'Percent of VA steps ≤ rated burden inside ±4% at 0 VA → ±2% at rated (no transducer margin — voltage readings).',
        compute: computePtBurdenTrapezoidInSpecPct,
        formatDisplay: formatPtBurdenTrapezoidDisplay,
        tierFn: getPtBurdenTrapezoidMethodTier,
        averageTierFn: getPtBurdenTrapezoidMethodTier
    },
    {
        id: 'tcf',
        label: 'IEEE TCF (Ratio+Drop)',
        description: 'IEEE TCF at rated VA burden from ratio + % drop phase estimate. Scored vs ±2% (no voltage transducer margin).',
        compute: computePtTcfScore,
        formatDisplay: formatPtTcfDisplay,
        tierFn: getPtTcfMethodTier,
        averageTierFn: getPtTcfMethodTier
    },
    {
        id: 'worst_point',
        label: 'Worst-Point Min',
        description: 'Lowest % accurate at any VA step up to rated burden.',
        compute: computePtWorstPointAccuracy,
        formatDisplay: function(pt, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(pt, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(pt, value) { return getInstrumentAccuracyTier(value); }
    },
    {
        id: 'rms_curve',
        label: 'RMS Curve Score',
        description: '100 minus the RMS of ratio errors across VA burden steps.',
        compute: computePtRmsCurveAccuracy,
        formatDisplay: function(pt, value) { return formatInstrumentAccuracyDisplay(value); },
        tierFn: function(pt, value) { return getInstrumentAccuracyTier(value); },
        averageTierFn: function(pt, value) { return getInstrumentAccuracyTier(value); }
    },
];

function computePtAccuracyForMethod(pt, methodDef) {
    if (!pt || !methodDef) return null;
    var value = methodDef.compute(pt);
    if (value == null || !isFinite(value)) return null;
    return {
        value: value,
        tier: methodDef.tierFn(pt, value),
        display: methodDef.formatDisplay(pt, value)
    };
}

function computePtAccuracyMethodsComparison(report) {
    var pts = (report && report.pts) || [];
    var methods = PT_ACCURACY_METHOD_DEFS.map(function(def) {
        var phases = [];
        for (var i = 0; i < pts.length && i < 3; i++) {
            var pt = pts[i];
            if (!pt || !instrumentHasBurdenTestData(pt)) continue;
            var result = computePtAccuracyForMethod(pt, def);
            if (!result) continue;
            phases.push({
                phase: resolveBurdenPhaseLetter(pt.va_burden_phase, i),
                value: result.value,
                tier: result.tier,
                display: result.display,
                ptIndex: i
            });
        }
        var values = phases.map(function(p) { return p.value; });
        var average = values.length
            ? values.reduce(function(a, b) { return a + b; }, 0) / values.length
            : null;
        var avgTierFn = def.averageTierFn || def.tierFn;
        return {
            id: def.id,
            label: def.label,
            description: def.description,
            phases: phases,
            average: average,
            averageTier: avgTierFn(null, average),
            averageDisplay: formatPtMethodAverageDisplay(def, average),
            hasData: phases.length > 0
        };
    });
    return {
        methods: methods,
        hasData: methods.some(function(m) { return m.hasData; })
    };
}

function computeMeterAccuracyBreakdown(report) {
    var skipped = !!(String((report && report.meter_test_skip) || '').trim());
    var defs = [
        { key: 'as_found_full_load', label: 'Full Load' },
        { key: 'as_found_light_load', label: 'Light Load' },
        { key: 'as_found_pf_test', label: 'PF Test' },
        { key: 'as_found_weighted_average', label: 'Weighted Average', primary: true }
    ];
    var items = defs.map(function(def) {
        var raw = skipped ? '' : String((report && report[def.key]) || '').trim();
        var n = parseFloat(String(raw).replace(/,/g, ''));
        var value = isFinite(n) ? n : null;
        var tier = 'empty';
        if (!skipped && value !== null) {
            if (value > 100.5 || value < 99.5) tier = 'bad';
            else if (value > 100.2 || value < 99.8) tier = 'warn';
            else tier = 'ok';
        }
        return {
            key: def.key,
            label: def.label,
            value: value,
            display: raw || '—',
            primary: !!def.primary,
            tier: tier
        };
    });
    var primary = null;
    items.forEach(function(item) {
        if (item.primary) primary = item;
    });
    return {
        skipped: skipped,
        items: items,
        primary: primary,
        hasData: !skipped && items.some(function(item) { return item.value !== null; })
    };
}

var REGISTRATION_CT_ERROR_THRESHOLD_PCT = 4;
var REGISTRATION_PT_ERROR_THRESHOLD_PCT = 3;

function parseMeterTestPercentValue(raw) {
    var n = parseFloat(String(raw || '').replace(/,/g, '').trim());
    return isFinite(n) ? n : null;
}

function getPhaseLoadAmps(report, phaseLetter) {
    if (!report || !phaseLetter) return null;
    var ph = String(phaseLetter).toLowerCase();
    return firstUsageValue(report, ['secondary_amps_' + ph, 'primary_amps_' + ph]);
}

function computeLoadWeightedInstrumentPct(phases, report) {
    if (!phases || !phases.length) return null;
    var hasAmps = phases.some(function(p) {
        var amps = getPhaseLoadAmps(report, p.phase);
        return amps != null && amps > 0;
    });
    var sumW = 0;
    var sumV = 0;
    phases.forEach(function(p) {
        if (p.value == null || !isFinite(p.value)) return;
        var w = 1;
        if (hasAmps) {
            var amps = getPhaseLoadAmps(report, p.phase);
            w = (amps != null && amps > 0) ? amps : 0;
            if (w <= 0) return;
        }
        sumW += w;
        sumV += w * p.value;
    });
    return sumW > 0 ? sumV / sumW : null;
}

function findBreakdownPhasePct(breakdown, phaseLetter) {
    if (!breakdown || !breakdown.phases) return null;
    for (var i = 0; i < breakdown.phases.length; i++) {
        if (breakdown.phases[i].phase === phaseLetter) return breakdown.phases[i].value;
    }
    return null;
}

function computeSiteRegistrationPct(meterPct, ctWeightedPct, ptWeightedPct) {
    if (meterPct == null || ctWeightedPct == null) return null;
    var pt = ptWeightedPct != null && isFinite(ptWeightedPct) ? ptWeightedPct : 100;
    return (meterPct / 100) * (ctWeightedPct / 100) * (pt / 100) * 100;
}

function computeRegistrationImpact(report) {
    if (!report) {
        return { hasData: false, showImpact: false, reason: 'no_report' };
    }
    var meterSkipped = !!(String(report.meter_test_skip || '').trim());
    var meterPct = meterSkipped ? null : parseMeterTestPercentValue(report.as_found_weighted_average);
    var ctBreakdown = computeCtAccuracyBreakdown(report);
    var hasPt = hasPtVtInstalled(report);
    var ptBreakdown = hasPt ? computePtAccuracyBreakdown(report) : null;
    var hasCt = ctBreakdown && ctBreakdown.hasData;
    var hasPtData = ptBreakdown && ptBreakdown.hasData;

    if (meterPct == null || !hasCt) {
        return {
            hasData: false,
            showImpact: false,
            reason: meterPct == null ? 'no_meter' : 'no_ct'
        };
    }

    var phaseRows = [];
    var showImpact = false;

    ctBreakdown.phases.forEach(function(ctPh) {
        var ctPct = ctPh.value;
        var ctError = getInstrumentAccuracyErrorPct(ctPct);
        var ptPct = hasPtData ? findBreakdownPhasePct(ptBreakdown, ctPh.phase) : null;
        if (ptPct == null) ptPct = hasPt ? 100 : 100;
        var ptError = hasPtData && findBreakdownPhasePct(ptBreakdown, ctPh.phase) != null
            ? getInstrumentAccuracyErrorPct(ptPct)
            : null;

        if (ctError != null && ctError > REGISTRATION_CT_ERROR_THRESHOLD_PCT) showImpact = true;
        if (ptError != null && ptError > REGISTRATION_PT_ERROR_THRESHOLD_PCT) showImpact = true;

        phaseRows.push({
            phase: ctPh.phase,
            amps: getPhaseLoadAmps(report, ctPh.phase),
            meterPct: meterPct,
            ctPct: ctPct,
            ctErrorPct: ctError,
            ptPct: ptPct,
            ptErrorPct: ptError,
            phaseRegistrationPct: computeSiteRegistrationPct(meterPct, ctPct, ptPct),
            ctExceedsThreshold: ctError != null && ctError > REGISTRATION_CT_ERROR_THRESHOLD_PCT,
            ptExceedsThreshold: ptError != null && ptError > REGISTRATION_PT_ERROR_THRESHOLD_PCT
        });
    });

    if (hasPtData) {
        ptBreakdown.phases.forEach(function(ptPh) {
            if (phaseRows.some(function(r) { return r.phase === ptPh.phase; })) return;
            var ptError = getInstrumentAccuracyErrorPct(ptPh.value);
            if (ptError != null && ptError > REGISTRATION_PT_ERROR_THRESHOLD_PCT) showImpact = true;
            phaseRows.push({
                phase: ptPh.phase,
                amps: getPhaseLoadAmps(report, ptPh.phase),
                meterPct: meterPct,
                ctPct: null,
                ctErrorPct: null,
                ptPct: ptPh.value,
                ptErrorPct: ptError,
                phaseRegistrationPct: null,
                ctExceedsThreshold: false,
                ptExceedsThreshold: ptError != null && ptError > REGISTRATION_PT_ERROR_THRESHOLD_PCT
            });
        });
    }

    var ctWeighted = computeLoadWeightedInstrumentPct(ctBreakdown.phases, report);
    var ptWeighted = hasPtData ? computeLoadWeightedInstrumentPct(ptBreakdown.phases, report) : 100;
    var siteRegistrationPct = computeSiteRegistrationPct(meterPct, ctWeighted, ptWeighted);
    var lossPct = siteRegistrationPct != null ? Math.max(0, 100 - siteRegistrationPct) : null;

    var totalAmps = 0;
    var hasAmps = phaseRows.some(function(r) { return r.amps != null && r.amps > 0; });
    phaseRows.forEach(function(r) {
        if (hasAmps && r.amps != null && r.amps > 0) totalAmps += r.amps;
    });
    phaseRows.forEach(function(r) {
        r.loadSharePct = hasAmps && totalAmps > 0 && r.amps != null && r.amps > 0
            ? (r.amps / totalAmps) * 100
            : (phaseRows.length ? 100 / phaseRows.length : null);
    });

    var recoveries = [];
    phaseRows.forEach(function(r) {
        if (r.ctExceedsThreshold) {
            var ctFixed = ctBreakdown.phases.map(function(p) {
                return { phase: p.phase, value: p.phase === r.phase ? 100 : p.value };
            });
            var newCtWeighted = computeLoadWeightedInstrumentPct(ctFixed, report);
            var newSite = computeSiteRegistrationPct(meterPct, newCtWeighted, ptWeighted);
            if (newSite != null && siteRegistrationPct != null) {
                recoveries.push({
                    type: 'ct',
                    phase: r.phase,
                    label: 'Fix Phase ' + r.phase + ' CT to 100% accurate',
                    instrumentPct: r.ctPct,
                    siteRegistrationPct: newSite,
                    recoveryPct: newSite - siteRegistrationPct,
                    lossAfterPct: Math.max(0, 100 - newSite)
                });
            }
        }
        if (r.ptExceedsThreshold && hasPtData) {
            var ptFixed = ptBreakdown.phases.map(function(p) {
                return { phase: p.phase, value: p.phase === r.phase ? 100 : p.value };
            });
            var newPtWeighted = computeLoadWeightedInstrumentPct(ptFixed, report);
            var newSitePt = computeSiteRegistrationPct(meterPct, ctWeighted, newPtWeighted);
            if (newSitePt != null && siteRegistrationPct != null) {
                recoveries.push({
                    type: 'pt',
                    phase: r.phase,
                    label: 'Fix Phase ' + r.phase + ' PT/VT to 100% accurate',
                    instrumentPct: r.ptPct,
                    siteRegistrationPct: newSitePt,
                    recoveryPct: newSitePt - siteRegistrationPct,
                    lossAfterPct: Math.max(0, 100 - newSitePt)
                });
            }
        }
    });

    return {
        hasData: true,
        showImpact: showImpact,
        meterPct: meterPct,
        ctWeightedPct: ctWeighted,
        ptWeightedPct: ptWeighted,
        siteRegistrationPct: siteRegistrationPct,
        lossPct: lossPct,
        phases: phaseRows,
        recoveries: recoveries,
        loadWeightSource: hasAmps ? 'amps' : 'equal',
        hasPt: hasPt,
        thresholds: {
            ctErrorPct: REGISTRATION_CT_ERROR_THRESHOLD_PCT,
            ptErrorPct: REGISTRATION_PT_ERROR_THRESHOLD_PCT
        }
    };
}

function formatAccuracyMethodTotalDisplay(method) {
    if (!method || method.average == null) return '—';
    if (method.id === 'burden_trapezoid' || method.id === 'parallelogram') {
        return method.averageDisplay || method.average.toFixed(0) + '%';
    }
    if (method.id === 'ieee_ratio_phase' || method.id === 'tcf' || method.id === 'class_bands') {
        return method.averageDisplay || method.average.toFixed(1) + '%';
    }
    return formatInstrumentAccuracyDisplay(method.average);
}

function renderRegistrationImpactHtml(impact, opts) {
    opts = opts || {};
    if (!impact || !impact.showImpact) return '';
    var valueClass = opts.valueClassPrefix || 'report-meter-test-';
    var panelClass = opts.panelClass || 'report-panel';
    var rowClass = opts.rowClass || 'final-review-acc-row';

    function tierClass(tier) {
        if (opts.useFinalReviewClasses) {
            if (tier === 'bad') return 'meter-test-out-red';
            if (tier === 'warn') return 'meter-test-warn-yellow';
            return '';
        }
        if (tier === 'bad') return valueClass + 'bad';
        if (tier === 'warn') return valueClass + 'warn';
        return valueClass + 'ok';
    }

    function valueSpan(display, tier) {
        var cls = tierClass(tier);
        return '<span class="final-review-acc-value' + (cls ? ' ' + cls : '') + '">' + display + '</span>';
    }

    var html = '<div class="' + panelClass + ' registration-impact-panel mt-2">';
    html += '<div class="font-semibold text-slate-800 mb-1">Estimated registration impact</div>';
    html += '<p class="text-xs text-slate-600 mb-2">Load-weighted using meter weighted avg × CT weighted burden avg × PT weighted burden avg. ';
    html += 'Shown when any CT error exceeds ' + impact.thresholds.ctErrorPct + '% or PT error exceeds ' +
        impact.thresholds.ptErrorPct + '%.</p>';

    html += '<div class="space-y-1 mb-2">';
    html += '<div class="' + rowClass + '"><span>Meter (weighted avg)</span>' +
        valueSpan(impact.meterPct.toFixed(3) + '%', 'ok') + '</div>';
    html += '<div class="' + rowClass + '"><span>CT factor (amps-weighted)</span>' +
        valueSpan(formatInstrumentAccuracyDisplay(impact.ctWeightedPct),
            getInstrumentAccuracyTier(impact.ctWeightedPct)) + '</div>';
    if (impact.hasPt) {
        html += '<div class="' + rowClass + '"><span>PT factor (amps-weighted)</span>' +
            valueSpan(formatInstrumentAccuracyDisplay(impact.ptWeightedPct),
                getInstrumentAccuracyTier(impact.ptWeightedPct)) + '</div>';
    }
    html += '<div class="' + rowClass + ' final-review-acc-primary"><span>Site registration</span>' +
        valueSpan(impact.siteRegistrationPct.toFixed(3) + '%',
            getInstrumentAccuracyTier(impact.siteRegistrationPct)) + '</div>';
    html += '<div class="' + rowClass + '"><span>Estimated under-registration</span>' +
        valueSpan(impact.lossPct.toFixed(3) + '%', impact.lossPct > 2 ? 'warn' : 'ok') + '</div>';
    html += '</div>';

    if (impact.phases && impact.phases.length) {
        html += '<div class="text-xs font-semibold text-slate-700 mb-1">Per phase</div>';
        html += '<div class="space-y-1 mb-2">';
        impact.phases.forEach(function(r) {
            var parts = ['Phase ' + r.phase];
            if (r.loadSharePct != null) parts.push(r.loadSharePct.toFixed(0) + '% load');
            if (r.ctPct != null) parts.push('CT ' + formatInstrumentAccuracyDisplay(r.ctPct));
            if (r.ptErrorPct != null) parts.push('PT ' + formatInstrumentAccuracyDisplay(r.ptPct));
            if (r.phaseRegistrationPct != null) parts.push('reg ' + r.phaseRegistrationPct.toFixed(2) + '%');
            var tier = 'ok';
            if (r.ctExceedsThreshold || r.ptExceedsThreshold) tier = 'bad';
            else if ((r.ctErrorPct != null && r.ctErrorPct > 2) || (r.ptErrorPct != null && r.ptErrorPct > 2)) tier = 'warn';
            html += '<div class="' + rowClass + '"><span>' + parts.join(' · ') + '</span>' +
                valueSpan(r.phaseRegistrationPct != null ? r.phaseRegistrationPct.toFixed(2) + '%' : '—', tier) + '</div>';
        });
        html += '</div>';
    }

    if (impact.recoveries && impact.recoveries.length) {
        html += '<div class="text-xs font-semibold text-slate-700 mb-1">Recovery if corrected</div>';
        html += '<div class="space-y-1">';
        impact.recoveries.forEach(function(rec) {
            html += '<div class="' + rowClass + '"><span>' + rec.label + '</span>' +
                valueSpan('+' + rec.recoveryPct.toFixed(3) + '% registration', 'ok') + '</div>';
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function burdenChartTickIndex(ticks, x) {
    if (!ticks || !ticks.length) return -1;
    for (var i = 0; i < ticks.length; i++) {
        if (Math.abs(ticks[i] - x) < 0.001) return i;
    }
    return -1;
}

function isCompactChartWidth(width) {
    return (width || 520) <= 420;
}

function resolveCompactChartLayout(opts, defaults) {
    defaults = defaults || {};
    var w = opts.width || defaults.w || 520;
    var compact = isCompactChartWidth(w);
    return {
        compact: compact,
        w: w,
        h: opts.height || defaults.h || 360,
        ml: compact ? (defaults.mlCompact || 40) : (defaults.ml || 54),
        mr: compact ? (defaults.mrCompact || 8) : (defaults.mr || 24),
        mt: compact ? (defaults.mtCompact || 14) : (defaults.mt || 36),
        mb: compact ? (defaults.mbCompact || 42) : (defaults.mb || 52)
    };
}

function appendCompactPhaseLegend(parts, phases, layout, y, opts) {
    opts = opts || {};
    var count = Math.max((phases || []).length, 1);
    var slot = layout.pw / count;
    var fontSize = layout.compact ? 7 : 9;
    var swatch = layout.compact ? 7 : 10;
    phases.forEach(function(series, idx) {
        var col = series.color || '#334155';
        var cx = layout.ml + slot * idx + slot * 0.12;
        var label = opts.labelFn ? opts.labelFn(series) : (series.label || series.phase || '');
        parts.push('<rect x="' + cx.toFixed(1) + '" y="' + (y - swatch + 2).toFixed(1) + '" width="' + swatch + '" height="' + swatch +
            '" fill="' + col + '" fill-opacity="0.35" stroke="' + col + '" rx="1.5"/>');
        parts.push('<text x="' + (cx + swatch + 3).toFixed(1) + '" y="' + (y + 1).toFixed(1) +
            '" font-size="' + fontSize + '" fill="#334155" font-weight="600">' + label + '</text>');
    });
}

function burdenChartXPos(x, chartData, ml, pw) {
    var xTicks = chartData.xTicks || [];
    var xMax = chartData.xMax || 4;
    if (chartData.xEqualSpacing && xTicks.length > 1) {
        var idx = burdenChartTickIndex(xTicks, x);
        if (idx < 0) return ml;
        return ml + (idx / (xTicks.length - 1)) * pw;
    }
    return ml + (x / xMax) * pw;
}

function burdenChartYRange(phases, yMin, yMax) {
    var min = yMin != null ? yMin : Infinity;
    var max = yMax != null ? yMax : -Infinity;
    (phases || []).forEach(function(series) {
        (series.points || []).forEach(function(pt) {
            if (pt.y < min) min = pt.y;
            if (pt.y > max) max = pt.y;
        });
    });
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 100;
    if (min === max) {
        min -= 5;
        max += 5;
    }
    var pad = Math.max((max - min) * 0.1, 2);
    return { min: min - pad, max: max + pad };
}

function buildCtBurdenChartData(report, metric) {
    prepareReportForCtBurdenCharts(report);
    var phaseKeys = ['A', 'B', 'C'];
    var phases = [];
    var cts = (report && report.cts) || [];
    for (var i = 0; i < cts.length && i < 3; i++) {
        var ct = cts[i];
        if (!ct) continue;
        ensureCtBurdenGrid(ct);
        var nameplate = getCtBurdenNameplateRatio(ct.ratio_size);
        var points = [];
        BURDEN_OHMS_LIST.forEach(function(ohms) {
            var row = ct.burden[ohms];
            if (!row) return;
            if (metric === 'accuracy') {
                if (!burdenRowHasCurrentReading(row)) return;
                var calc = calcBurdenCtRatio(row.pri, row.sec);
                var pct = calcBurdenPctAccurate(calc, nameplate);
                if (pct == null || !isFinite(pct)) return;
                points.push({ x: parseFloat(ohms), label: ohms + ' Ω', y: pct });
            } else if (metric === 'drop') {
                var dropVal = resolveBurdenRowDropValue(row, ohms);
                if (dropVal == null) return;
                var remaining = calcBurdenPctRemainingFromDrop(dropVal);
                if (remaining == null || !isFinite(remaining)) return;
                points.push({ x: parseFloat(ohms), label: ohms + ' Ω', y: remaining });
            }
        });
        if (points.length) {
            var pk = phaseKeys[i];
            phases.push({
                phase: pk,
                label: ct.burden_phase || ('CT-' + pk),
                color: WSAPP_PHASE_VOLTAGE_COLORS[pk],
                points: points
            });
        }
    }
    return {
        phases: phases,
        title: metric === 'accuracy' ? 'CT Accuracy Graph' : 'CT % Drop Graph',
        xLabel: 'Burden (Ω)',
        yLabel: metric === 'accuracy' ? '% Accurate' : '% Accurate (100 − drop)',
        xMax: 4,
        xTicks: BURDEN_OHMS_LIST.map(function(o) { return parseFloat(o); }),
        xEqualSpacing: true,
        yMin: null,
        yMax: null,
        referenceY: metric === 'accuracy' || metric === 'drop' ? 100 : null,
        emptyMessage: describeCtBurdenChartEmpty(report, metric)
    };
}

function buildPtBurdenChartData(report, metric) {
    var phaseKeys = ['A', 'B', 'C'];
    var phases = [];
    var pts = (report && report.pts) || [];
    for (var i = 0; i < pts.length && i < 3; i++) {
        var pt = pts[i];
        if (!pt || !pt.va_burden) continue;
        var points = [];
        PT_BURDEN_VA_LIST.forEach(function(va) {
            var row = pt.va_burden[va];
            if (!row) return;
            if (metric === 'accuracy') {
                if (!String(row.pri_v || '').trim() && !String(row.sec_v || '').trim()) return;
                var calc = calcPtBurdenRatio(row.pri_v, row.sec_v, pt.ratio_size);
                var pct = calcPtBurdenPctAccurate(calc, pt.ratio_size);
                if (pct == null || !isFinite(pct)) return;
                points.push({ x: parseFloat(va), label: va + ' VA', y: pct });
            } else if (metric === 'drop' && va !== '0') {
                if (String(row.drop || '').trim() === '') return;
                var drop = Number(String(row.drop).replace(/,/g, ''));
                if (isNaN(drop)) return;
                points.push({ x: parseFloat(va), label: va + ' VA', y: drop });
            }
        });
        if (points.length) {
            var pk = phaseKeys[i];
            phases.push({
                phase: pk,
                label: pt.va_burden_phase || ('PT-' + pk),
                color: WSAPP_PHASE_VOLTAGE_COLORS[pk],
                points: points
            });
        }
    }
    return {
        phases: phases,
        title: metric === 'accuracy' ? 'PT Accuracy Graph' : 'PT % Drop Graph',
        xLabel: 'Burden (VA)',
        yLabel: metric === 'accuracy' ? '% Accurate' : '% Drop',
        xMax: 175,
        xTicks: PT_BURDEN_VA_LIST.map(function(v) { return parseFloat(v); }),
        yMin: metric === 'accuracy' ? 90 : 0,
        yMax: metric === 'accuracy' ? 110 : null,
        referenceY: metric === 'accuracy' ? 100 : null
    };
}

function renderBurdenLineChartSvg(chartData, opts) {
    opts = opts || {};
    var w = opts.width || 520;
    var h = opts.height || 360;
    var svgId = opts.svgId || 'wsapp-burden-chart-svg';
    if (!chartData || !chartData.phases || !chartData.phases.length) {
        var msg = (chartData && chartData.emptyMessage) ||
            'No burden data to graph yet. Enter values on CT/PT Burden Data.';
        return '<div class="text-xs text-slate-500 text-center py-8 px-4 leading-relaxed">' + msg + '</div>';
    }

    var ml = 54;
    var mr = 24;
    var mt = 36;
    var mb = 52;
    var pw = w - ml - mr;
    var ph = h - mt - mb;
    var yRange = burdenChartYRange(chartData.phases, chartData.yMin, chartData.yMax);

    function xPos(x) {
        return burdenChartXPos(x, chartData, ml, pw);
    }
    function yPos(y) {
        return mt + ph - ((y - yRange.min) / (yRange.max - yRange.min)) * ph;
    }

    var parts = [];
    parts.push('<svg id="' + svgId + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (chartData.title || 'Burden chart') + '">');
    parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>');

    var xTicks = chartData.xTicks || [];
    xTicks.forEach(function(tick) {
        var x = xPos(tick);
        parts.push('<line x1="' + x.toFixed(1) + '" y1="' + mt + '" x2="' + x.toFixed(1) + '" y2="' + (mt + ph) + '" stroke="#f1f5f9" stroke-width="1"/>');
    });

    var yTickCount = 5;
    for (var yi = 0; yi <= yTickCount; yi++) {
        var yVal = yRange.min + (yRange.max - yRange.min) * (yi / yTickCount);
        var y = yPos(yVal);
        parts.push('<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>');
        parts.push('<text x="' + (ml - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="#64748b">' + yVal.toFixed(yVal % 1 ? 1 : 0) + '</text>');
    }

    parts.push('<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');
    parts.push('<line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (ml + pw) + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');

    if (chartData.referenceY != null) {
        var refY = yPos(chartData.referenceY);
        parts.push('<line x1="' + ml + '" y1="' + refY.toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + refY.toFixed(1) + '" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>');
    }

    xTicks.forEach(function(tick) {
        var x = xPos(tick);
        var label = tick < 1 ? tick.toFixed(1) : String(tick).replace(/\.0$/, '');
        parts.push('<text x="' + x.toFixed(1) + '" y="' + (mt + ph + 16) + '" text-anchor="middle" font-size="9" fill="#64748b">' + label + '</text>');
    });

    parts.push('<text x="' + (ml + pw / 2) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="10" fill="#475569" font-weight="600">' + chartData.xLabel + '</text>');
    parts.push('<text x="14" y="' + (mt + ph / 2) + '" text-anchor="middle" font-size="10" fill="#475569" font-weight="600" transform="rotate(-90 14 ' + (mt + ph / 2) + ')">' + chartData.yLabel + '</text>');

    chartData.phases.forEach(function(series) {
        var col = series.color || '#334155';
        var pts = series.points.slice().sort(function(a, b) { return a.x - b.x; });
        if (pts.length > 1) {
            var path = 'M';
            pts.forEach(function(pt, idx) {
                path += (idx ? ' L' : '') + xPos(pt.x).toFixed(1) + ' ' + yPos(pt.y).toFixed(1);
            });
            parts.push('<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round"/>');
        }
        pts.forEach(function(pt) {
            var cx = xPos(pt.x);
            var cy = yPos(pt.y);
            parts.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5" fill="' + col + '" stroke="#ffffff" stroke-width="1.5"/>');
        });
    });

    var legendX = ml + 8;
    var legendY = 12;
    chartData.phases.forEach(function(series, idx) {
        var col = series.color || '#334155';
        var lx = legendX + idx * 88;
        parts.push('<rect x="' + lx + '" y="' + (legendY - 8) + '" width="10" height="10" fill="' + col + '" rx="2"/>');
        parts.push('<text x="' + (lx + 14) + '" y="' + legendY + '" font-size="9" fill="#334155" font-weight="600">' + series.label + '</text>');
    });

    parts.push('</svg>');
    return parts.join('');
}

/** Parse CT accuracy class (e.g. ".30", "0.3", "1.2") to percent tolerance. */
function parseCtAccuracyClassPct(val) {
    var s = String(val || '').trim();
    if (!s) return null;
    if (s.charAt(0) === '.') s = '0' + s;
    var n = parseFloat(s.replace(/,/g, ''));
    return isFinite(n) && n > 0 ? n : null;
}

/** Parse CT burden rating (Ω) from CT Data screen. */
function parseCtBurdenRatingOhms(val) {
    var n = parseFloat(String(val || '').replace(/,/g, '').trim());
    return isFinite(n) && n >= 0 ? n : null;
}

/**
 * Metering CT parallelogram bounds (ratio error %) at a given burden (Ω).
 * IEEE field practice: ±2× class at 0 Ω, ±1× class at rated burden; flat beyond rated.
 */
function ctParallelogramErrorBoundsAtBurden(burdenOhms, accuracyPct, ratedBurdenOhms) {
    var acc = accuracyPct;
    var rated = ratedBurdenOhms > 0 ? ratedBurdenOhms : 0;
    var x = burdenOhms;
    if (rated <= 0) {
        return { top: acc, bottom: -acc };
    }
    if (x > rated) {
        return { top: acc, bottom: -acc };
    }
    var t = x / rated;
    return {
        top: (2 * acc) - t * acc,
        bottom: -(2 * acc) + t * acc
    };
}

function isPointInsideCtParallelogram(burdenOhms, ratioErrorPct, accuracyPct, ratedBurdenOhms) {
    if (ratioErrorPct == null || !isFinite(ratioErrorPct) || accuracyPct == null) return null;
    if (ratedBurdenOhms != null && burdenOhms > ratedBurdenOhms + 0.001) return null;
    var b = ctParallelogramErrorBoundsAtBurden(burdenOhms, accuracyPct, ratedBurdenOhms);
    return ratioErrorPct >= b.bottom && ratioErrorPct <= b.top;
}

function buildCtParallelogramChartData(report) {
    prepareReportForCtBurdenCharts(report);
    var phaseKeys = ['A', 'B', 'C'];
    var phases = [];
    var envelopeOnly = [];
    var plotXMax = 0;
    var cts = (report && report.cts) || [];
    for (var i = 0; i < cts.length && i < 3; i++) {
        var ct = cts[i];
        if (!ct) continue;
        var acc = parseCtAccuracyClassPct(ct.accuracy_class);
        var rated = resolveCtRatedBurdenOhms(ct);
        if (acc == null || rated == null) continue;
        ensureCtBurdenGrid(ct);
        var nameplate = getCtBurdenNameplateRatio(ct.ratio_size);
        var points = [];
        BURDEN_OHMS_LIST.forEach(function(ohms) {
            var row = ct.burden[ohms];
            if (!row || !burdenRowHasCurrentReading(row)) return;
            var calc = calcBurdenCtRatio(row.pri, row.sec);
            var err = calcBurdenRatioErrorPct(calc, nameplate);
            if (err == null || !isFinite(err)) return;
            var x = parseFloat(ohms);
            var aboveRated = x > rated + 0.001;
            points.push({
                x: x,
                label: ohms + ' Ω',
                y: err,
                aboveRated: aboveRated,
                inside: aboveRated ? null : isPointInsideFieldBurdenTrapezoid(x, err, rated)
            });
            if (x > plotXMax) plotXMax = x;
        });
        plotXMax = Math.max(plotXMax, rated);
        var pk = phaseKeys[i];
        var series = {
            phase: pk,
            label: ct.burden_phase || ('CT-' + pk),
            color: WSAPP_PHASE_VOLTAGE_COLORS[pk],
            accuracyPct: acc,
            envelopeTop0: CT_FIELD_RATIO_ERR_AT_ZERO_PCT + CT_PRIMARY_TRANSDUCER_MARGIN_PCT,
            envelopeTopRated: CT_FIELD_RATIO_ERR_AT_RATED_PCT + CT_PRIMARY_TRANSDUCER_MARGIN_PCT,
            ratedBurden: rated,
            points: points
        };
        if (points.length) phases.push(series);
        else envelopeOnly.push(series);
    }
    var xTicks = BURDEN_OHMS_LIST.map(function(o) { return parseFloat(o); })
        .filter(function(t) { return t <= plotXMax + 0.001; });
    if (!xTicks.length && plotXMax > 0) xTicks = [0, plotXMax];
    return {
        phases: phases.length ? phases : envelopeOnly,
        title: 'CT Burden Ratio Trapezoid',
        subtitle: 'Field envelope (+1% CT transducer): ±' + (CT_FIELD_RATIO_ERR_AT_ZERO_PCT + CT_PRIMARY_TRANSDUCER_MARGIN_PCT) +
            '% at 0 Ω → ±' + (CT_FIELD_RATIO_ERR_AT_RATED_PCT + CT_PRIMARY_TRANSDUCER_MARGIN_PCT) + '% at rated.',
        xLabel: 'Burden (Ω)',
        yLabel: 'Ratio Error %',
        xMax: Math.max(plotXMax, 0.1),
        xTicks: xTicks,
        yMin: null,
        yMax: null,
        referenceY: 0,
        emptyMessage: describeCtBurdenChartEmpty(report, 'parallelogram')
    };
}

function describeCtIeeeParallelogramChartEmpty(report) {
    if (!report || !(report.cts || []).length) {
        return 'No CTs on this service. Add CT blocks on CT Data first.';
    }
    prepareReportForCtBurdenCharts(report);
    var missingClass = false;
    var missingReadings = true;
    (report.cts || []).forEach(function(ct) {
        if (!parseCtAccuracyClassPct(ct.accuracy_class)) missingClass = true;
        if (collectCtBurdenAccuracySamples(ct).length) missingReadings = false;
    });
    var parts = [];
    if (missingClass) parts.push('enter <strong>Accuracy Class</strong> on CT Data');
    if (missingReadings) parts.push('enter burden <strong>Primary I</strong> / <strong>Secondary I</strong> on CT Burden Data');
    return parts.length
        ? parts.join('; ') + '.'
        : 'No plottable IEEE parallelogram points yet.';
}

function buildCtIeeeParallelogramChartData(report) {
    prepareReportForCtBurdenCharts(report);
    var phaseKeys = ['A', 'B', 'C'];
    var phases = [];
    var maxAcc = 0.3;
    var maxPhaseMin = 15;
    var maxRatioExtent = 0;
    var maxPhaseExtent = 0;
    var cts = (report && report.cts) || [];
    for (var i = 0; i < cts.length && i < 3; i++) {
        var ct = cts[i];
        if (!ct) continue;
        var acc = parseCtAccuracyClassPct(ct.accuracy_class);
        if (acc == null) continue;
        var samples = collectCtBurdenAccuracySamples(ct);
        if (!samples.length) continue;
        var rated = resolveCtRatedBurdenOhms(ct);
        var sample = pickCtBurdenSampleForIeeeTest(samples, rated);
        if (!sample || sample.ratioError == null) continue;
        ensureCtBurdenGrid(ct);
        var row = ct.burden && ct.burden[sample.ohms];
        var phaseErrMin = resolveCtPhaseErrorMinutesForBurdenTest(ct, row);
        var phaseMin = phaseErrMin;
        var phaseLimit = getIeeeC5713PhaseLimitMinutes(acc);
        var tcfErr = computeCtTcfErrorPct(sample.ratioError, phaseErrMin);
        var inside = tcfErr != null && Math.abs(tcfErr) <= getCtTcfFieldLimitPct();
        if (acc > maxAcc) maxAcc = acc;
        if (phaseLimit > maxPhaseMin) maxPhaseMin = phaseLimit;
        maxRatioExtent = Math.max(maxRatioExtent, Math.abs(sample.ratioError), acc);
        maxPhaseExtent = Math.max(maxPhaseExtent, Math.abs(phaseMin), phaseLimit);
        var pk = phaseKeys[i];
        phases.push({
            phase: pk,
            label: ct.burden_phase || ('CT-' + pk),
            color: WSAPP_PHASE_VOLTAGE_COLORS[pk],
            accuracyPct: acc,
            phaseLimitMin: phaseLimit,
            ratedBurden: rated,
            testPoint: {
                x: sample.ratioError,
                y: phaseMin,
                inside: inside,
                burdenOhms: sample.burden
            }
        });
    }
    return {
        phases: phases,
        title: 'IEEE C57.13 Ratio–Phase Parallelogram',
        subtitle: 'Rated-burden TCF (+1% CT transducer margin): limit ±' + getCtTcfFieldLimitPct(true) + '%.',
        xLabel: 'Ratio Error %',
        yLabel: 'Phase (minutes)',
        xMax: Math.max(maxRatioExtent * 1.35, maxAcc * 1.5, 0.5),
        yMax: Math.max(maxPhaseExtent * 1.35, maxPhaseMin * 1.15, 12),
        emptyMessage: describeCtIeeeParallelogramChartEmpty(report)
    };
}

function renderCtParallelogramChartSvg(chartData, opts) {
    opts = opts || {};
    var layout = resolveCompactChartLayout(opts, { h: 360, mbCompact: 50 });
    var w = layout.w;
    var h = layout.h;
    var svgId = opts.svgId || 'wsapp-burden-chart-svg';
    if (!chartData || !chartData.phases || !chartData.phases.length) {
        var paraMsg = (chartData && chartData.emptyMessage) ||
            'Enter Accuracy Class and Burden Rating on CT Data, then burden readings on CT Burden Data.';
        return '<div class="text-xs text-slate-500 text-center py-8 px-4 leading-relaxed">' + paraMsg + '</div>';
    }

    var ml = layout.ml;
    var mr = layout.mr;
    var mt = layout.mt;
    var mb = layout.mb;
    var pw = w - ml - mr;
    var ph = h - mt - mb;
    var xMax = chartData.xMax || 4;
    var yRange = burdenChartYRange(chartData.phases, chartData.yMin, chartData.yMax);
    var compact = layout.compact;

    function xPos(x) {
        return ml + (x / xMax) * pw;
    }
    function yPos(y) {
        return mt + ph - ((y - yRange.min) / (yRange.max - yRange.min)) * ph;
    }

    var parts = [];
    parts.push('<svg id="' + svgId + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CT Burden Ratio Trapezoid">');
    parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>');

    if (!compact && chartData.subtitle) {
        parts.push('<text x="' + (ml + pw / 2) + '" y="20" text-anchor="middle" font-size="8" fill="#64748b">' + chartData.subtitle + '</text>');
    }

    var xTicks = chartData.xTicks || [];
    xTicks.forEach(function(tick) {
        var x = xPos(tick);
        parts.push('<line x1="' + x.toFixed(1) + '" y1="' + mt + '" x2="' + x.toFixed(1) + '" y2="' + (mt + ph) + '" stroke="#f1f5f9" stroke-width="1"/>');
    });

    var yTickCount = compact ? 3 : 5;
    for (var yi = 0; yi <= yTickCount; yi++) {
        var yVal = yRange.min + (yRange.max - yRange.min) * (yi / yTickCount);
        var y = yPos(yVal);
        parts.push('<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>');
        parts.push('<text x="' + (ml - 4) + '" y="' + (y + 2.5).toFixed(1) + '" text-anchor="end" font-size="' + (compact ? 7 : 9) + '" fill="#64748b">' + yVal.toFixed(yVal % 1 ? 1 : 0) + '</text>');
    }

    parts.push('<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');
    parts.push('<line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (ml + pw) + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');

    if (chartData.referenceY != null) {
        var refY = yPos(chartData.referenceY);
        parts.push('<line x1="' + ml + '" y1="' + refY.toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + refY.toFixed(1) + '" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>');
    }

    chartData.phases.forEach(function(series) {
        var col = series.color || '#334155';
        var err0 = series.envelopeTop0 != null ? series.envelopeTop0 : CT_FIELD_RATIO_ERR_AT_ZERO_PCT;
        var errRated = series.envelopeTopRated != null ? series.envelopeTopRated : CT_FIELD_RATIO_ERR_AT_RATED_PCT;
        var rated = series.ratedBurden;
        if (rated == null) return;

        var x0 = xPos(0);
        var xRated = xPos(Math.min(rated, xMax));
        var yTop0 = yPos(err0);
        var yTopRated = yPos(errRated);
        var yBot0 = yPos(-err0);
        var yBotRated = yPos(-errRated);

        var poly = 'M' + x0.toFixed(1) + ' ' + yTop0.toFixed(1) +
            ' L' + xRated.toFixed(1) + ' ' + yTopRated.toFixed(1) +
            ' L' + xRated.toFixed(1) + ' ' + yBotRated.toFixed(1) +
            ' L' + x0.toFixed(1) + ' ' + yBot0.toFixed(1) + ' Z';
        parts.push('<path d="' + poly + '" fill="' + col + '" fill-opacity="0.12" stroke="' + col + '" stroke-width="1.5" stroke-opacity="0.55"/>');

        if (rated > 0 && rated <= xMax) {
            parts.push('<line x1="' + xRated.toFixed(1) + '" y1="' + mt + '" x2="' + xRated.toFixed(1) + '" y2="' + (mt + ph) + '" stroke="' + col + '" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.45"/>');
        }

        var pts = (series.points || []).slice().sort(function(a, b) { return a.x - b.x; });
        var scoredPts = pts.filter(function(pt) { return pt.inside !== null; });
        if (scoredPts.length > 1) {
            var path = 'M';
            scoredPts.forEach(function(pt, idx) {
                path += (idx ? ' L' : '') + xPos(pt.x).toFixed(1) + ' ' + yPos(pt.y).toFixed(1);
            });
            parts.push('<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-dasharray="5,3"/>');
        }
        pts.forEach(function(pt) {
            var cx = xPos(pt.x);
            var cy = yPos(pt.y);
            var ring;
            if (pt.aboveRated || pt.inside === null) {
                ring = '#94a3b8';
            } else {
                ring = pt.inside === false ? '#dc2626' : '#16a34a';
            }
            var opacity = pt.aboveRated ? ' fill-opacity="0.45"' : '';
            var r = compact ? 4 : 5;
            parts.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="' + col + '"' + opacity + ' stroke="' + ring + '" stroke-width="1.5"/>');
        });
    });

    xTicks.forEach(function(tick, tickIdx) {
        if (compact && tickIdx > 0 && tickIdx < xTicks.length - 1 && tickIdx % 2 === 1) return;
        var x = xPos(tick);
        var label = tick < 1 ? tick.toFixed(1) : String(tick).replace(/\.0$/, '');
        var ty = mt + ph + (compact ? 11 : 16);
        if (compact) {
            parts.push('<text x="' + x.toFixed(1) + '" y="' + ty + '" text-anchor="end" font-size="7" fill="#64748b" transform="rotate(-35 ' + x.toFixed(1) + ' ' + ty + ')">' + label + '</text>');
        } else {
            parts.push('<text x="' + x.toFixed(1) + '" y="' + ty + '" text-anchor="middle" font-size="9" fill="#64748b">' + label + '</text>');
        }
    });

    parts.push('<text x="' + (ml + pw / 2) + '" y="' + (h - (compact ? 18 : 8)) + '" text-anchor="middle" font-size="' + (compact ? 8 : 10) + '" fill="#475569" font-weight="600">' + chartData.xLabel + '</text>');
    if (!compact) {
        parts.push('<text x="12" y="' + (mt + ph / 2) + '" text-anchor="middle" font-size="10" fill="#475569" font-weight="600" transform="rotate(-90 12 ' + (mt + ph / 2) + ')">' + chartData.yLabel + '</text>');
    }

    appendCompactPhaseLegend(parts, chartData.phases, { ml: ml, pw: pw, compact: compact }, h - (compact ? 10 : 10));
    if (!compact) {
        parts.push('<text x="' + (ml + pw / 2) + '" y="' + (h - 1) + '" text-anchor="middle" font-size="8" fill="#64748b">Green = in spec · Red = out · Gray = above rated (not scored)</text>');
    }

    parts.push('</svg>');
    return parts.join('');
}

function renderCtIeeeParallelogramChartSvg(chartData, opts) {
    opts = opts || {};
    var layout = resolveCompactChartLayout(opts, { h: 360, mbCompact: 40 });
    var w = layout.w;
    var h = layout.h;
    var svgId = opts.svgId || 'wsapp-ieee-para-svg';
    if (!chartData || !chartData.phases || !chartData.phases.length) {
        var msg = (chartData && chartData.emptyMessage) ||
            'Enter CT accuracy class and burden Primary I / Secondary I on CT Burden Data.';
        return '<div class="text-xs text-slate-500 text-center py-8 px-4 leading-relaxed border border-dashed border-slate-300 rounded-xl bg-slate-50">' + msg + '</div>';
    }

    var ml = layout.ml;
    var mr = layout.mr;
    var mt = layout.mt;
    var mb = layout.mb;
    var pw = w - ml - mr;
    var ph = h - mt - mb;
    var xMax = chartData.xMax || 1;
    var yMax = chartData.yMax || 20;
    var compact = layout.compact;

    function xPos(x) {
        return ml + ((x + xMax) / (2 * xMax)) * pw;
    }
    function yPos(y) {
        return mt + ph - ((y + yMax) / (2 * yMax)) * ph;
    }

    var parts = [];
    parts.push('<svg id="' + svgId + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="IEEE C57.13 CT Parallelogram">');
    parts.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>');

    if (!compact) {
        parts.push('<text x="' + (ml + pw / 2) + '" y="18" text-anchor="middle" font-size="11" fill="#1e293b" font-weight="700">' +
            (chartData.title || 'IEEE C57.13 Ratio–Phase Parallelogram') + '</text>');
        if (chartData.subtitle) {
            parts.push('<text x="' + (ml + pw / 2) + '" y="34" text-anchor="middle" font-size="8" fill="#64748b">' + chartData.subtitle + '</text>');
        }
    }

    var xTickVals = compact ? [-xMax, 0, xMax] : [-xMax, -xMax / 2, 0, xMax / 2, xMax];
    xTickVals.forEach(function(tick) {
        if (Math.abs(tick) > xMax + 0.001) return;
        var x = xPos(tick);
        parts.push('<line x1="' + x.toFixed(1) + '" y1="' + mt + '" x2="' + x.toFixed(1) + '" y2="' + (mt + ph) + '" stroke="#f1f5f9" stroke-width="1"/>');
    });
    var yTickVals = compact ? [-yMax, 0, yMax] : [-yMax, -yMax / 2, 0, yMax / 2, yMax];
    yTickVals.forEach(function(tick) {
        if (Math.abs(tick) > yMax + 0.001) return;
        var y = yPos(tick);
        parts.push('<line x1="' + ml + '" y1="' + y.toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + y.toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>');
    });

    parts.push('<line x1="' + xPos(0).toFixed(1) + '" y1="' + mt + '" x2="' + xPos(0).toFixed(1) + '" y2="' + (mt + ph) + '" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>');
    parts.push('<line x1="' + ml + '" y1="' + yPos(0).toFixed(1) + '" x2="' + (ml + pw) + '" y2="' + yPos(0).toFixed(1) + '" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>');
    parts.push('<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');
    parts.push('<line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (ml + pw) + '" y2="' + (mt + ph) + '" stroke="#cbd5e1" stroke-width="1.5"/>');

    chartData.phases.forEach(function(series) {
        var col = series.color || '#334155';
        var acc = series.accuracyPct;
        var phaseLimit = series.phaseLimitMin;
        if (acc == null || phaseLimit == null || !series.testPoint) return;

        var poly = 'M' + xPos(acc).toFixed(1) + ' ' + yPos(0).toFixed(1) +
            ' L' + xPos(0).toFixed(1) + ' ' + yPos(phaseLimit).toFixed(1) +
            ' L' + xPos(-acc).toFixed(1) + ' ' + yPos(0).toFixed(1) +
            ' L' + xPos(0).toFixed(1) + ' ' + yPos(-phaseLimit).toFixed(1) + ' Z';
        parts.push('<path d="' + poly + '" fill="' + col + '" fill-opacity="0.22" stroke="' + col + '" stroke-width="' + (compact ? 1.5 : 2) + '" stroke-opacity="0.8"/>');

        var pt = series.testPoint;
        var cx = xPos(pt.x);
        var cy = yPos(pt.y);
        var ring = pt.inside === false ? '#dc2626' : (pt.inside === true ? '#16a34a' : '#64748b');
        parts.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (compact ? 5 : 7) + '" fill="' + col + '" stroke="' + ring + '" stroke-width="2"/>');
    });

    xTickVals.forEach(function(tick) {
        if (Math.abs(tick) > xMax + 0.001) return;
        parts.push('<text x="' + xPos(tick).toFixed(1) + '" y="' + (mt + ph + (compact ? 11 : 16)) + '" text-anchor="middle" font-size="' + (compact ? 7 : 9) + '" fill="#64748b">' + tick.toFixed(1) + '</text>');
    });
    yTickVals.forEach(function(tick) {
        if (Math.abs(tick) > yMax + 0.001) return;
        parts.push('<text x="' + (ml - 4) + '" y="' + (yPos(tick) + 2.5).toFixed(1) + '" text-anchor="end" font-size="' + (compact ? 7 : 9) + '" fill="#64748b">' + tick.toFixed(0) + '</text>');
    });

    parts.push('<text x="' + (ml + pw / 2) + '" y="' + (h - (compact ? 18 : 8)) + '" text-anchor="middle" font-size="' + (compact ? 8 : 10) + '" fill="#475569" font-weight="600">' + chartData.xLabel + '</text>');
    if (!compact) {
        parts.push('<text x="12" y="' + (mt + ph / 2) + '" text-anchor="middle" font-size="10" fill="#475569" font-weight="600" transform="rotate(-90 12 ' + (mt + ph / 2) + ')">' + chartData.yLabel + '</text>');
    }

    appendCompactPhaseLegend(parts, chartData.phases, { ml: ml, pw: pw, compact: compact }, h - (compact ? 10 : 10));
    if (!compact) {
        parts.push('<text x="' + (ml + pw / 2) + '" y="' + (h - 1) + '" text-anchor="middle" font-size="8" fill="#64748b">Green = in spec · Red = out</text>');
    }

    parts.push('</svg>');
    return parts.join('');
}

function renderCtParallelogramChartsHtml(report, opts) {
    opts = opts || {};
    var w = opts.width || 520;
    var h = opts.height || 260;
    var html = '';
    html += '<div class="mb-3">';
    html += renderCtIeeeParallelogramChartSvg(buildCtIeeeParallelogramChartData(report), {
        svgId: opts.ieeeSvgId || 'wsapp-ieee-para-svg',
        width: w,
        height: opts.ieeeHeight || 340
    });
    html += '</div>';
    html += renderCtParallelogramChartSvg(buildCtParallelogramChartData(report), {
        svgId: opts.burdenSvgId || 'wsapp-burden-trapezoid-svg',
        width: w,
        height: h
    });
    return html;
}

// --- Transformer KVA / primary service ---

function isPrimaryServiceTransType(reportOrType) {
    var val = (reportOrType && typeof reportOrType === 'object')
        ? reportOrType.trans_type
        : reportOrType;
    return String(val || '').trim() === 'Primary Service';
}

function parseTransformerKvaSize(val) {
    if (val == null || val === '') return 0;
    var s = String(val).trim().replace(/,/g, '');
    var m = s.match(/^(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : 0;
}

function computeTotalTransformerKva(report) {
    if (!report) return '';
    if (isPrimaryServiceTransType(report)) return '';
    var transformers = report.transformers || [];
    var total = 0;
    var hasAny = false;
    for (var i = 0; i < 3; i++) {
        var t = transformers[i] || {};
        var kva = parseTransformerKvaSize(t.size);
        if (kva > 0) hasAny = true;
        total += kva;
    }
    if (!hasAny) return '';
    return Number.isInteger(total) ? String(total) : String(total);
}

// --- CT admittance ---

function computeCtAdmittanceAvg(low, high) {
    var l = Number(String(low == null ? '' : low).trim().replace(/,/g, ''));
    var h = Number(String(high == null ? '' : high).trim().replace(/,/g, ''));
    var hasL = !isNaN(l) && String(low).trim() !== '';
    var hasH = !isNaN(h) && String(high).trim() !== '';
    if (hasL && hasH) return (l + h) / 2;
    if (hasL) return l;
    if (hasH) return h;
    return '';
}

    var WSAPP_CALC = {
    METER_FORM_CANONICAL: METER_FORM_CANONICAL,
    NINE_S_WYE_FORMS: NINE_S_WYE_FORMS,
    isNineSWyeForm: isNineSWyeForm,
    BURDEN_OHMS_LIST: BURDEN_OHMS_LIST,
    PT_BURDEN_VA_LIST: PT_BURDEN_VA_LIST,
    normalizeMeterForm: normalizeMeterForm,
    getCtCountForForm: getCtCountForForm,
    getReportForm: getReportForm,
    getPhaseFromServiceDesc: getPhaseFromServiceDesc,
    getReportPhase: getReportPhase,
    getListedMultiplier: getListedMultiplier,
    parseCtRatioNameplate: parseCtRatioNameplate,
    getCtRatioFactor: getCtRatioFactor,
    describeCtRatioForFormula: describeCtRatioForFormula,
    parsePtRatioParts: parsePtRatioParts,
    normalizePtSizeNameplate: normalizePtSizeNameplate,
    getPtVtRatioFactor: getPtVtRatioFactor,
    describePtRatioForFormula: describePtRatioForFormula,
    formatCalculatedMultiplierValue: formatCalculatedMultiplierValue,
    isThreePhaseMultiplierForm: isThreePhaseMultiplierForm,
    getReportPtVtRatioLabel: getReportPtVtRatioLabel,
    getReportCtRatioLabel: getReportCtRatioLabel,
    getTimeBatchCtRatio: getTimeBatchCtRatio,
    getTimeBatchPtRatio: getTimeBatchPtRatio,
    getReportPtVtFactor: getReportPtVtFactor,
    getReportPtPrimaryNameplate: getReportPtPrimaryNameplate,
    isHighVoltagePtService: isHighVoltagePtService,
    computeUsagePrimaryVoltFromSecondary: computeUsagePrimaryVoltFromSecondary,
    applyUsagePrimaryVoltAutofill: applyUsagePrimaryVoltAutofill,
    getUsagePrimaryVoltAutofillPairs: getUsagePrimaryVoltAutofillPairs,
    getMissingUsagePrimaryVolts: getMissingUsagePrimaryVolts,
    USAGE_PRIMARY_VOLT_FIELDS: USAGE_PRIMARY_VOLT_FIELDS,
    computeSingleCtMultiplier: computeSingleCtMultiplier,
    computeCalculatedMultiplier: computeCalculatedMultiplier,
    computeCalculatedMultiplierFormula: computeCalculatedMultiplierFormula,
    computeMultiplierMatch: computeMultiplierMatch,
    applyMultiplierCalculations: applyMultiplierCalculations,
    parseAngleDegrees: parseAngleDegrees,
    normalizeAngleDegrees: normalizeAngleDegrees,
    pfCosineFromAngleDeg: pfCosineFromAngleDeg,
    pfCosine180Minus: pfCosine180Minus,
    getFirstPhaseAngle: getFirstPhaseAngle,
    isSixSMeterFamily: isSixSMeterFamily,
    FOUR_S_DISABLED_USAGE_FIELDS: FOUR_S_DISABLED_USAGE_FIELDS,
    ALL_USAGE_LAYOUT_FIELD_KEYS: ALL_USAGE_LAYOUT_FIELD_KEYS,
    getFiveSUsageVariant: getFiveSUsageVariant,
    getFiveSEnabledUsageFields: getFiveSEnabledUsageFields,
    isFiveSUsageLayoutForm: isFiveSUsageLayoutForm,
    applyFiveSDisabledUsageFields: applyFiveSDisabledUsageFields,
    isSelfContainedMeterForm: isSelfContainedMeterForm,
    is16SUsageLayoutForm: is16SUsageLayoutForm,
    is12SUsageLayoutForm: is12SUsageLayoutForm,
    get12SUsageVariant: get12SUsageVariant,
    get12SEnabledUsageFields: get12SEnabledUsageFields,
    get16SEnabledUsageFields: get16SEnabledUsageFields,
    getSelfContainedEnabledUsageFields: getSelfContainedEnabledUsageFields,
    applySelfContainedDisabledUsageFields: applySelfContainedDisabledUsageFields,
    applySelfContainedPrimaryVoltMirror: applySelfContainedPrimaryVoltMirror,
    isFiveSFourWireDelta: isFiveSFourWireDelta,
    estimateSixSPhaseBAngle: estimateSixSPhaseBAngle,
    getCalculatedPowerFactors: getCalculatedPowerFactors,
    formatCalcPfDisplay: formatCalcPfDisplay,
    formatCalcPfExport: formatCalcPfExport,
    getCalcPfOutlineTier: getCalcPfOutlineTier,
    calcBurdenPctRemainingFromDrop: calcBurdenPctRemainingFromDrop,
    detectNineSServiceLayout: detectNineSServiceLayout,
    NINE_S_VECTOR_VISUAL_V: NINE_S_VECTOR_VISUAL_V,
    NINE_S_VECTOR_VISUAL_I: NINE_S_VECTOR_VISUAL_I,
    WSAPP_PHASE_VOLTAGE_COLORS: WSAPP_PHASE_VOLTAGE_COLORS,
    WSAPP_PHASE_CURRENT_COLORS: WSAPP_PHASE_CURRENT_COLORS,
    buildNineSVectorPhasors: buildNineSVectorPhasors,
    build3SVectorPhasors: build3SVectorPhasors,
    build4SVectorPhasors: build4SVectorPhasors,
    buildVectorPhasors: buildVectorPhasors,
    supportsVectorDiagram: supportsVectorDiagram,
    renderNineSVectorDiagramSvg: renderNineSVectorDiagramSvg,
    render3SVectorDiagramSvg: render3SVectorDiagramSvg,
    render4SVectorDiagramSvg: render4SVectorDiagramSvg,
    renderVectorDiagramSvg: renderVectorDiagramSvg,
    buildCtBurdenChartData: buildCtBurdenChartData,
    buildPtBurdenChartData: buildPtBurdenChartData,
    renderBurdenLineChartSvg: renderBurdenLineChartSvg,
    parseCtAccuracyClassPct: parseCtAccuracyClassPct,
    parseCtBurdenRatingOhms: parseCtBurdenRatingOhms,
    ctFieldBurdenErrorBoundsAtBurden: ctFieldBurdenErrorBoundsAtBurden,
    isPointInsideFieldBurdenTrapezoid: isPointInsideFieldBurdenTrapezoid,
    ctParallelogramErrorBoundsAtBurden: ctParallelogramErrorBoundsAtBurden,
    isPointInsideCtParallelogram: isPointInsideCtParallelogram,
    buildCtParallelogramChartData: buildCtParallelogramChartData,
    buildCtIeeeParallelogramChartData: buildCtIeeeParallelogramChartData,
    renderCtParallelogramChartSvg: renderCtParallelogramChartSvg,
    renderCtIeeeParallelogramChartSvg: renderCtIeeeParallelogramChartSvg,
    renderCtParallelogramChartsHtml: renderCtParallelogramChartsHtml,
    getTimedRevMultiplier: getTimedRevMultiplier,
    computeTimedRevKw: computeTimedRevKw,
    computeTimedRevKwSimple: computeTimedRevKwSimple,
    formatTimedRevKwDisplay: formatTimedRevKwDisplay,
    formatTimedRevKwExport: formatTimedRevKwExport,
    LEGACY_BURDEN_OHMS_MAP: LEGACY_BURDEN_OHMS_MAP,
    ensureCtBurdenGrid: ensureCtBurdenGrid,
    migrateLegacyCtBurdenFields: migrateLegacyCtBurdenFields,
    prepareReportForCtBurdenCharts: prepareReportForCtBurdenCharts,
    getCtBurdenNameplateRatio: getCtBurdenNameplateRatio,
    calcBurdenRatioErrorPct: calcBurdenRatioErrorPct,
    calcBurdenCtRatio: calcBurdenCtRatio,
    calcBurdenPctAccurate: calcBurdenPctAccurate,
    formatBurdenCalcDisplay: formatBurdenCalcDisplay,
    calcPtBurdenRatio: calcPtBurdenRatio,
    calcPtBurdenPctAccurate: calcPtBurdenPctAccurate,
    parsePtBurdenRatingVa: parsePtBurdenRatingVa,
    resolveBurdenPhaseLetter: resolveBurdenPhaseLetter,
    resolveCtRatedBurdenOhms: resolveCtRatedBurdenOhms,
    getCtBurdenOhmsUpToRating: getCtBurdenOhmsUpToRating,
    getPtVaStepsUpToRating: getPtVaStepsUpToRating,
    getInstrumentAccuracyTier: getInstrumentAccuracyTier,
    formatInstrumentAccuracyDisplay: formatInstrumentAccuracyDisplay,
    collectCtBurdenAccuracySamples: collectCtBurdenAccuracySamples,
    computeCtWeightedAccuracy: computeCtWeightedAccuracy,
    computeCtBurdenTrapezoidInSpecPct: computeCtBurdenTrapezoidInSpecPct,
    computeCtParallelogramInSpecPct: computeCtParallelogramInSpecPct,
    computeCtIeeeRatioPhaseScore: computeCtIeeeRatioPhaseScore,
    getBurdenRowDropPct: getBurdenRowDropPct,
    computeCtTcfErrorPct: computeCtTcfErrorPct,
    getCtPhaseAngleErrorMinutes: getCtPhaseAngleErrorMinutes,
    resolveCtPhaseErrorMinutesForBurdenTest: resolveCtPhaseErrorMinutesForBurdenTest,
    isInsideIeeeC5713RatioPhaseParallelogram: isInsideIeeeC5713RatioPhaseParallelogram,
    formatCtMethodAverageDisplay: formatCtMethodAverageDisplay,
    computeCtWorstPointAccuracy: computeCtWorstPointAccuracy,
    computeCtRmsCurveAccuracy: computeCtRmsCurveAccuracy,
    computeCtClassBandScore: computeCtClassBandScore,
    CT_ACCURACY_METHOD_DEFS: CT_ACCURACY_METHOD_DEFS,
    computeCtAccuracyForMethod: computeCtAccuracyForMethod,
    computeCtAccuracyMethodsComparison: computeCtAccuracyMethodsComparison,
    computePtWeightedAccuracy: computePtWeightedAccuracy,
    CT_PRIMARY_TRANSDUCER_MARGIN_PCT: CT_PRIMARY_TRANSDUCER_MARGIN_PCT,
    withCtTransducerMargin: withCtTransducerMargin,
    applyCtTransducerMarginToPctAccurate: applyCtTransducerMarginToPctAccurate,
    scoreMarginToClassBandLimit: scoreMarginToClassBandLimit,
    collectPtBurdenAccuracySamples: collectPtBurdenAccuracySamples,
    PT_ACCURACY_METHOD_DEFS: PT_ACCURACY_METHOD_DEFS,
    computePtAccuracyForMethod: computePtAccuracyForMethod,
    computePtAccuracyMethodsComparison: computePtAccuracyMethodsComparison,
    computeCtAccuracyBreakdown: computeCtAccuracyBreakdown,
    computePtAccuracyBreakdown: computePtAccuracyBreakdown,
    computeMeterAccuracyBreakdown: computeMeterAccuracyBreakdown,
    REGISTRATION_CT_ERROR_THRESHOLD_PCT: REGISTRATION_CT_ERROR_THRESHOLD_PCT,
    REGISTRATION_PT_ERROR_THRESHOLD_PCT: REGISTRATION_PT_ERROR_THRESHOLD_PCT,
    parseMeterTestPercentValue: parseMeterTestPercentValue,
    getPhaseLoadAmps: getPhaseLoadAmps,
    computeLoadWeightedInstrumentPct: computeLoadWeightedInstrumentPct,
    computeSiteRegistrationPct: computeSiteRegistrationPct,
    computeRegistrationImpact: computeRegistrationImpact,
    formatAccuracyMethodTotalDisplay: formatAccuracyMethodTotalDisplay,
    renderRegistrationImpactHtml: renderRegistrationImpactHtml,
    computeCtAdmittanceAvg: computeCtAdmittanceAvg,
    isPrimaryServiceTransType: isPrimaryServiceTransType,
    parseTransformerKvaSize: parseTransformerKvaSize,
    computeTotalTransformerKva: computeTotalTransformerKva,
    BILLING_RATES: BILLING_RATES,
    UTILITY_BILLING_SURCHARGE: UTILITY_BILLING_SURCHARGE,
    hasPtVtInstalled: hasPtVtInstalled,
    getBaseBillingCodeAndRate: getBaseBillingCodeAndRate,
    applyBillingUtilitySurcharge: applyBillingUtilitySurcharge,
    getBillingCodeAndRate: getBillingCodeAndRate
    };

    wsappCalcFactory(WSAPP_CALC);
})(function(WSAPP_CALC) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WSAPP_CALC;
    }
    if (typeof window !== 'undefined') {
        window.WSAPP_CALC = WSAPP_CALC;
    }
});