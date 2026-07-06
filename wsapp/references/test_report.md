# WSApp Test Report — Standalone Companion

**App version:** 1.6.0  
**Page:** `companions/test-report/test-report.html`  
**Logic:** `companions/test-report/scripts/wsapp-test-report.js` (+ import/export modules, `companions/charts/scripts/wsapp-chart-bundle.js`)

## Design rule

The Test Report is a **standalone web page** with **minimal coupling** to `index.html`:

| Coupling | Direction | Contract |
|----------|-----------|----------|
| Active report snapshot | WSApp → Test Report | `localStorage['wsapp_active_field_report']` |
| Utility display name | Test Report reads | `localStorage['wsapp_current_utility']` (optional) |
| Republish on Refresh (iframe only) | Test Report → WSApp | `window.parent.WSAPP_REPUBLISH_VISUAL()` |
| Close / Back (iframe only) | Test Report → WSApp | `window.parent.closeVisualViewerModal()` |

**Do not** add field-entry logic, save flows, or export batch code to the Test Report.  
**Do not** require edits to `index.html` when changing report layout, charts, or print/share behavior.

## Data contract (`wsapp_active_field_report`)

```json
{
  "saved_at": "ISO-8601",
  "report_id": "optional entry id",
  "utility": "CITY OF AVA",
  "data": { }
}
```

`data` is a normalized field-report object (same shape as `field_report.data` in `wsapp_field_data`).

## Standalone use (no WSApp open)

1. Open `test-report.html` directly (same folder as WSApp).
2. Click **Load JSON** and pick:
   - a full device backup (`wsapp_backup_*.json`), or
   - an active-report payload (object with `data`), or
   - a single field-report `data` object.
3. Print, Download HTML, or Share from the toolbar.

## Field deploy

`npm run package` includes `companions/test-report/`, `companions/charts/`, `shared/scripts/wsapp-calculations.js` (external load for companions), `wsapp-utility-profiles.js`, and `wsapp-visual-bridge.js`.

## Meter accuracy color bands (client report)

The Test Report uses fixed bands in `scripts/visuals/wsapp-test-report.js` (`METER_TEST_TIER_BANDS`):

| Tier | Range (%) | Meaning |
|------|-----------|---------|
| OK | 99.8 – 100.2 | Within normal field-test tolerance |
| Review | 99.5 – 99.8 or 100.2 – 100.5 | Slightly outside ideal — office review |
| Action | &lt; 99.5 or &gt; 100.5 | Outside typical ANSI C12.1 Class 1.0 field band |

The page renders **two documents** from one data load:

1. **Summary** (`#section-summary`) — one-page overall assessment with utility + Watthour Solutions letterhead, logo, and key metrics. Has its own Print / Share / Download (toolbar row + inline buttons in the section).
2. **Full Test Report** (`#report-document-full`) — detailed sections (Account, Meter, Socket, CT/PT, Usage, Burden, Vector, Notes). Tier legend and collapsible engineering blocks.

### WSApp field nav (under Field Notes)

| Button | Opens | URL |
|--------|-------|-----|
| **Test Summary** | One-page assessment | `test-report.html?embed=1&view=summary` |
| **Full Test Report** | Detailed sections (tables, no charts) | `test-report.html?embed=1&view=full` |
| **Charts / Graphs** | Vector + CT/PT burden charts in one scroll | `test-report.html?embed=1&view=charts` |

Modal footer Print / Download / Share target the **active view** (summary, full, or charts). Standalone `test-report.html` (no `view`) shows summary + full with a full toolbar.

One-way coupling only: WSApp publishes `wsapp_active_field_report` and opens the iframe. Core save/export/complete flows do not call test-report code.

## Future work (post desktop eval)

- PDF export
- Utility letterhead tweaks per `references/utility_profiles.json`