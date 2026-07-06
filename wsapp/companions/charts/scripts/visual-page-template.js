/**
 * Node helper — writes standalone visual HTML pages from a template.
 * Run: node scripts/visuals/visual-page-template.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const PAGES = [
    {
        file: 'vector-diagram.html',
        title: 'Vector Diagram',
        short: 'Vector Diagram',
        icon: 'fa-compass-drafting',
        theme: 'violet',
        script: 'wsapp-vector-diagram.js'
    },
    {
        file: 'ct-accuracy-graph.html',
        title: 'CT Accuracy Graph',
        short: 'CT Accuracy',
        icon: 'fa-chart-line',
        theme: 'red',
        script: 'wsapp-ct-accuracy-graph.js'
    },
    {
        file: 'ct-drop-graph.html',
        title: 'CT % Drop Graph',
        short: 'CT % Drop',
        icon: 'fa-chart-area',
        theme: 'red',
        script: 'wsapp-ct-drop-graph.js'
    },
    {
        file: 'ct-parallelogram.html',
        title: 'CT Parallelogram',
        short: 'CT Parallelogram',
        icon: 'fa-draw-polygon',
        theme: 'red',
        script: 'wsapp-ct-parallelogram.js'
    },
    {
        file: 'pt-accuracy-graph.html',
        title: 'PT Accuracy Graph',
        short: 'PT Accuracy',
        icon: 'fa-chart-line',
        theme: 'blue',
        script: 'wsapp-pt-accuracy-graph.js'
    },
    {
        file: 'pt-drop-graph.html',
        title: 'PT % Drop Graph',
        short: 'PT % Drop',
        icon: 'fa-chart-area',
        theme: 'blue',
        script: 'wsapp-pt-drop-graph.js'
    }
];

const THEMES = {
    violet: {
        header: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
        border: 'border-violet-200',
        panel: 'bg-violet-50',
        title: 'text-violet-900',
        icon: 'text-violet-600',
        btnShare: 'border-violet-300 text-violet-800 bg-violet-50 hover:bg-violet-100',
        btnDl: 'bg-violet-700 hover:bg-violet-800'
    },
    red: {
        header: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
        border: 'border-red-200',
        panel: 'bg-red-50',
        title: 'text-red-900',
        icon: 'text-red-600',
        btnShare: 'border-red-300 text-red-800 bg-red-50 hover:bg-red-100',
        btnDl: 'bg-red-700 hover:bg-red-800'
    },
    blue: {
        header: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
        border: 'border-blue-200',
        panel: 'bg-blue-50',
        title: 'text-blue-900',
        icon: 'text-blue-600',
        btnShare: 'border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100',
        btnDl: 'bg-blue-700 hover:bg-blue-800'
    }
};

function renderPage(page) {
    var t = THEMES[page.theme];
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>WSApp ${page.title}</title>
    <link rel="apple-touch-icon" href="assets/logo.png">
    <meta name="apple-mobile-web-app-title" content="WSApp ${page.short}">
    <script src="assets/tailwindcdn.js" onerror="(function(){var s=document.createElement('script');s.src='https://cdn.tailwindcss.com';document.head.appendChild(s);})();"></script>
    <link rel="stylesheet" href="assets/fontawesome/css/all.min.css" onerror="this.onerror=null;this.href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';">
    <style>
        html, body { min-height: 100%; margin: 0; }
        body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .wsapp-visual-header { background: ${t.header}; }
        body.wsapp-visual-embed { background: #fff; min-height: auto; }
        body.wsapp-visual-embed .wsapp-visual-page-header,
        body.wsapp-visual-embed .wsapp-visual-footnote { display: none !important; }
        body.wsapp-visual-embed main { padding: 0; max-width: none; }
        body.wsapp-visual-embed .wsapp-visual-card { border-radius: 0; box-shadow: none; border: 0; }
    </style>
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen flex flex-col">

    <header class="wsapp-visual-page-header wsapp-visual-header text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
        <div class="flex items-center gap-3 min-w-0">
            <img src="assets/logo.png" alt="" class="w-8 h-8 rounded-lg bg-white/10 shrink-0" onerror="this.style.display='none'">
            <div class="min-w-0">
                <div class="font-semibold text-sm leading-tight truncate flex items-center gap-2">
                    <i class="fa-solid ${page.icon}"></i>
                    <span>${page.title}</span>
                </div>
                <div class="text-[11px] text-white/80 truncate">Standalone visual — reads active report from WSApp</div>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
            <button type="button" id="btn-refresh" class="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-xs font-semibold rounded-xl flex items-center gap-1">
                <i class="fa-solid fa-rotate"></i> Refresh
            </button>
            <button type="button" id="btn-back-wsapp" class="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-xs font-semibold rounded-xl flex items-center gap-1">
                <i class="fa-solid fa-arrow-left"></i> WSApp
            </button>
        </div>
    </header>

    <main class="flex-1 p-4 max-w-3xl mx-auto w-full">
        <div class="wsapp-visual-card bg-white rounded-3xl shadow-lg border ${t.border} overflow-hidden">
            <div class="px-5 py-4 ${t.panel} border-b ${t.border}">
                <div class="font-semibold text-lg ${t.title} flex items-center gap-2">
                    <i class="fa-solid ${page.icon} ${t.icon}"></i>
                    <span>${page.title}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div><span class="font-semibold text-slate-500">Locate ID:</span> <span id="visual-locate" class="font-mono text-slate-800">—</span></div>
                    <div><span class="font-semibold text-slate-500">Member:</span> <span id="visual-member" class="text-slate-800">—</span></div>
                    <div><span class="font-semibold text-slate-500">Meter #:</span> <span id="visual-meter" class="font-mono text-slate-800">—</span></div>
                </div>
                <p id="visual-refresh-note" class="text-[10px] text-slate-500 mt-2 leading-snug"></p>
            </div>
            <div class="p-4 bg-white" id="visual-chart-host">
                <div class="text-xs text-slate-500 text-center py-8">Loading…</div>
            </div>
            <div class="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-end gap-2">
                <button type="button" id="btn-share" class="px-4 py-2 text-sm font-medium border rounded-2xl flex items-center gap-x-2 ${t.btnShare}">
                    <i class="fa-solid fa-share-nodes"></i><span>Share</span>
                </button>
                <button type="button" id="btn-download" class="px-4 py-2 text-sm font-semibold text-white rounded-2xl flex items-center gap-x-2 ${t.btnDl}">
                    <i class="fa-solid fa-download"></i><span>Download Image</span>
                </button>
            </div>
        </div>
        <p class="wsapp-visual-footnote text-[10px] text-slate-400 text-center mt-4 leading-snug px-2">
            Companion page only — edit this file and scripts/visuals/${page.script} without touching index.html.
        </p>
    </main>

    <script src="scripts/wsapp-calculations.js"></script>
    <script src="scripts/wsapp-visual-bridge.js"></script>
    <script src="scripts/visuals/wsapp-visual-shell.js"></script>
    <script src="scripts/visuals/${page.script}"></script>
</body>
</html>
`;
}

PAGES.forEach(function (page) {
    fs.writeFileSync(path.join(ROOT, page.file), renderPage(page), 'utf8');
    console.log('Wrote', page.file);
});