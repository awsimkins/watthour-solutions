/** AUTO-GENERATED from references/utility_profiles.json — run: node scripts/sync-utility-profiles.js */
(function () {
    window.WSAPP_UTILITY_PROFILES = {
    "GENERAL": {
        "name": "General",
        "address": "",
        "city": "",
        "state": "",
        "zip": ""
    },
    "BARTON COUNTY ELECTRIC COOPERATIVE": {
        "name": "Barton County Electric Cooperative",
        "address": "P.O. Box 968",
        "city": "Lamar",
        "state": "MO",
        "zip": "64759"
    },
    "CITY OF AVA": {
        "name": "City of Ava",
        "address": "100 W Washington Ave",
        "city": "Ava",
        "state": "MO",
        "zip": "65608"
    },
    "CITY OF MOUNT VERNON": {
        "name": "City of Mount Vernon",
        "address": "",
        "city": "Mount Vernon",
        "state": "MO",
        "zip": ""
    },
    "CITY OF SEYMOUR": {
        "name": "City of Seymour",
        "address": "",
        "city": "Seymour",
        "state": "MO",
        "zip": ""
    },
    "CITY OF ST JAMES": {
        "name": "City of St. James",
        "address": "403 N Jefferson St",
        "city": "St. James",
        "state": "MO",
        "zip": "65559"
    },
    "CITY OF ST. ROBERT": {
        "name": "City of St. Robert",
        "address": "",
        "city": "St. Robert",
        "state": "MO",
        "zip": ""
    },
    "CO-MO ELECTRIC COOPERATIVE": {
        "name": "Co-Mo Electric Cooperative",
        "address": "P.O. Box 37",
        "city": "Tipton",
        "state": "MO",
        "zip": "65081"
    },
    "CRAWFORD ELECTRIC COOPERATIVE": {
        "name": "Crawford Electric Cooperative",
        "address": "",
        "city": "Bourbon",
        "state": "MO",
        "zip": ""
    },
    "LACLEDE ELECTRIC COOPERATIVE": {
        "name": "Laclede Electric Cooperative",
        "address": "",
        "city": "Lebanon",
        "state": "MO",
        "zip": ""
    },
    "OSAGE VALLEY ELECTRIC COOPERATIVE": {
        "name": "Osage Valley Electric Cooperative",
        "address": "",
        "city": "Bunceton",
        "state": "MO",
        "zip": ""
    },
    "OZARK ELECTRIC COOPERATIVE": {
        "name": "Ozark Electric Cooperative",
        "address": "",
        "city": "Fayetteville",
        "state": "AR",
        "zip": ""
    },
    "PETIT JEAN ELECTRIC COOPERATIVE": {
        "name": "Petit Jean Electric Cooperative",
        "address": "",
        "city": "Clinton",
        "state": "AR",
        "zip": ""
    },
    "SE-MA-NO ELECTRIC COOPERATIVE": {
        "name": "SE-MA-NO Electric Cooperative",
        "address": "",
        "city": "Sikeston",
        "state": "MO",
        "zip": ""
    },
    "SOUTHWEST ELECTRIC COOPERATIVE": {
        "name": "Southwest Electric Cooperative",
        "address": "",
        "city": "Bolivar",
        "state": "MO",
        "zip": ""
    },
    "VERDIGRIS VALLEY ELECTRIC COOPERATIVE": {
        "name": "Verdigris Valley Electric Cooperative",
        "address": "",
        "city": "Collinsville",
        "state": "OK",
        "zip": ""
    },
    "WEBSTER ELECTRIC COOPERATIVE": {
        "name": "Webster Electric Cooperative",
        "address": "",
        "city": "Marshfield",
        "state": "MO",
        "zip": ""
    }
};
    window.WSAPP_FORMAT_UTILITY_ADDRESS = function (utilityKey) {
        var p = window.WSAPP_UTILITY_PROFILES[utilityKey];
        if (!p) return "";
        var line1 = String(p.address || "").trim();
        var line2 = [p.city, p.state, p.zip].filter(function (x) { return String(x || "").trim(); }).join(", ");
        if (line1 && line2) return line1 + ", " + line2;
        return line1 || line2 || "";
    };
    window.WSAPP_UTILITY_DISPLAY_NAME = function (utilityKey) {
        var p = window.WSAPP_UTILITY_PROFILES[utilityKey];
        return (p && p.name) ? p.name : (utilityKey || "General");
    };
})();
