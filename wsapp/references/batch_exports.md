# WSApp — Batch Export Formats

**App version:** 1.6.0
**Reference for CSV batch files** generated from History → **Export** (pick which batches to download).

## Export workflow

1. **History → Export**
2. Picker shows all 8 batches (all checked) — uncheck any you do not need
3. Selected CSVs download; filename suffix = **export run date** (today), e.g. `invoice_batch_20260628.csv`

**Backup JSON** is separate (History → **Backup JSON**) — use for mid-week device snapshots without CSV export.

## Date and time formats (by batch)

| Batch | Date | Time |
|-------|------|------|
| `fullbatch` | Mixed in wide row — see `flattenFieldReportToRow()` | Mixed |
| `mileage_expense_batch` | `MM/DD/YY` e.g. `06/28/26` | `HH:MM` e.g. `13:45` |
| `time_batch` | `yyyymmdd` | `HH:MM` |
| `skipped_batch` | `yyyymmdd` | `HH:MM` |
| `reminders_batch` | `MM/DD/YY` | `HH:MM` |
| `invoice_batch` | `yyyymmdd` (`test_date`) | `HH:MM` (`start_time`) |
| `utility_batch` | `yyyymmdd` (in data row) | — |

### Numeric export formatting (fullbatch + utility batches)

Applied on **export only** — values in the app / JSON backup stay as typed.

| Field group | CSV format |
|-------------|------------|
| **KWh register** | Exactly as typed (4, 5, or 6 digits; leading zeros preserved) |
| **Usage volts** (`primary_volts_*`, `secondary_volts_*`) | 1 decimal (`120.0`) |
| **Usage amps** (`primary_amps_*`, `secondary_amps_*`) + ground/testing amps | 2 decimals (`12.50`) |
| **Phase angles** | Rounded to whole degrees (`120`) |
| **THD** (voltage + current) | 1 decimal (`2.3`) |
| **Kh / Kt** | 1 decimal (`7.5`) |
| **As-found accuracy %** (full load, light load, PF test, weighted average) | 3 decimals (`100.051`) |
| **CT burden chart % drop** (`ct*_burden_*_drop`) | 2 decimals (`1.23`) |
| **CT admittance** (`usage_ct_admittance_*_low_ms`, `_high_ms`, `_avg_ms` per phase) | 1 decimal (`3.0`); millisiemens (mS). Low, high, and average all exported |

Exports include **all stored entries** on the device (not “today only”). Each batch type is **one CSV file** with **one row per record**.

Filename suffix uses export run date: e.g. `fullbatch_20260617.csv`.

---

## 1. `fullbatch`

**Purpose:** Complete field test capture — every entered field, one row per **completed** field report (drafts excluded). This is the “everything” export.

**Source:** `flattenFieldReportToRow()` — full column set (account, meter, socket, transformer, CT, PT, burden, usage, notes, billing_code, etc.). **`notes` is always the last column.**

**Leading columns (fixed order):**

| Column | Format / rule |
|--------|----------------|
| `utility` | Dashboard utility tag |
| `test_date` | `yyyymmdd` from visit date |
| `drive_time` | Drive minutes — `Math.ceil(drive_seconds / 60)`; blank if 0 |
| `test_time` | On-site test minutes — `Math.ceil(test_seconds / 60)`; blank if 0 |
| `start_time` | `HH:MM` e.g. `13:45` (visit time in) |
| `end_time` | `HH:MM` e.g. `14:56` (visit time out) |
| `tech_initials` | Owner initials (`AWS`) |
| `employee_initials` | `EMP` when employee-on-site checked; blank otherwise |
| `employee_on_site` | `YES` / `NO` |
| `truck_id` | Defaults to `107` if blank |
| `mileage` | Odometer as entered |
| `test_reason` | FT / FR / MR |
| `latitude` / `longitude` | Site GPS |
| `yearly_test_number` | Immediately after `utility` |
| `location_id` | MAP # / location |
| `account_id` | Account number |
| `customer_member_id` | Member / customer name |
| `meter_id` | Meter serial |
| `service_address` | Street / service address |
| `service_location` | Service location description |
| `service_description` | Service description (from `service_desc`) |
| `load_type` | Load type from master list / account |
| `meter_form` | Meter form |
| `ct_size` / `pt_size` | Master-list CT/PT size hints |
| `list_multiplier` | Listed multiplier |
| `previous_kw` | Max demand (`max_demand`) |
| `service_voltage` | T1 secondary voltage from nameplate |
| `list_notes` | Master list notes (not job notes) |
| `phone_number_1` / `phone_number_2` | Customer phones |

**Excluded from fullbatch:** `weekly_test_number`, `phase` (derived from `service_description`), `test_reason_short`, `entry_id`

**Meter accuracy block:** `meter_as_found_*` then `meter_as_left_*` (as-left auto-copies as-found — meter not adjusted in field). `initial_timed_revolution` then `final_timed_revolution` (grouped together). Renames: `meter_voltage`, `meter_test_amps`.

**Multiplier calc:** Per CT: `(CT ratio × PT/VT ratio × center-tap factor) ÷ primary turns ÷ double-pass divisor`. CT `200:5` → 40. PT blank → 1. Double pass on that CT → ÷2. Center tapped → ×2. **9S / 3-phase:** average the three CT multipliers (do not multiply CTs together). `multiplier_match` = YES when listed equals calculated (±0.01).

**Yearly test #:** Stamped at **Complete Test** (not draft preview). Missing on old completed rows is backfilled on load/export.

**Slot consistency:** Always **3 CT** and **3 PT/VT** column groups. Unused slots export **blank cells** (not placeholder numbers). PT/VT UI capped at 3 blocks.

**Status:** Layout under active desktop CSV review (v1.3.0). Columns may still change before iPad deploy.

**Column prefixes (fullbatch):**
- Meter: `meter_*` (e.g. `meter_kwh`, `meter_pf`, `meter_as_found_full_load`)
- Socket: `socket_*` (e.g. `socket_mfg`, `socket_surge_protector` YES/NO)
- Transformer site: `transformer_type`, `trans_centertapped`, `trans_in_enclosure_or_ground`, `trans_open_front`, `trans_ground_*`, `locking_device`, `pad_bolt_type`
- Transformer nameplates: `trans_1_size`, `trans_2_mfg`, …; `trans_total_size` immediately after `trans_3_size` (sum of T1–T3 kVA; blank for Primary Service)
- CT slots: `ct1_ratio_size`, `ct1_burden_0_1_pri`, … (always 3 slots; blank if unused)
- PT slots: `pt1_ratio_size`, `pt1_va_burden_0_pri_v`, `pt1_va_burden_25_pri_v`, … through `pt1_va_burden_175_pct_accurate` (VA steps: **0, 25, 50, 75, 100, 125, 150, 175**; always 3 PT slots)
- Usage: `usage_primary_volts_an`, `usage_ct_admittance_a_avg_ms`, …

**Removed from fullbatch (v1.1.260628)** — use notes or prefixed columns instead:
- `burden_va`, `burden_type`, `power_factor` (legacy; meter PF is `meter_pf`)
- `pt_vt_ratio`, `ct_size` (use `pt1_ratio_size`, `ct1_ratio_size`)
- `usage_hours_per_day_load`, `usage_days_per_week_load`, `usage_average_load_of_max`, `usage_imbalance_factor`
- `socket_damaged` (checkbox adds job note only)
- `trans_1_front_type`, `trans_2_front_type`, `trans_3_front_type`

**Intentionally omitted from CSV** (stored on device / JSON backup only):
- `entry_id`, `entry_created_ymd`, military time duplicates (`time_in_mil`, `time_out_mil`)
- Route GPS: `initial_latitude`, `initial_longitude` (site GPS `latitude`/`longitude` are exported)
- `meter_bad_display` (adds job note when checked)

---

## 2. `mileage_expense_batch`

**Purpose:** Mileage and expense log rows for office import.

**Canonical field names:** see `references/csv_field_definitions.txt`.

| Column | Description |
|--------|-------------|
| date | `MM/DD/YY` — e.g. `06/27/26` (same calendar day as `test_date`) |
| start_time | `HH:MM` 24-hour — e.g. `13:45` |
| truck_id | Truck # |
| mileage | Odometer / trip mileage |
| blank | *(empty)* |
| utility | Utility tag (auto field-test / skip rows) |
| map_location_id | MAP # for auto rows; vendor name for manual expense |
| service_address | Street / service address |
| city | City — **blank** on auto field-test rows |
| state | State — **blank** on auto field-test rows |
| b_p | `BUSINESS` or `PERSONAL` — **always `BUSINESS`** on auto field-test rows |
| amount | Dollar amount — **blank** on auto field-test rows |
| latitude | GPS latitude |
| longitude | GPS longitude |
| field_notes | Field report notes on auto field-test rows; expense/skip notes otherwise |

---

## 3. `time_batch`

**Purpose:** Drive and test duration per completed field report.

| Column | Description |
|--------|-------------|
| utility | Utility tag |
| test_date | Visit date `yyyymmdd` |
| start_time | Time in `HH:MM` — e.g. `13:45` (time in, or time out if no time in) |
| meter_form | Meter form |
| service_description | Service description from field report |
| transformer_type | Pole Mount / Pad Mount / Primary Service |
| ct_ratio | CT1 `ratio_size` from field report — blank if no CT |
| pt_ratio | PT1 `ratio_size` from field report — blank if no PT |
| drive_time | Drive minutes (rounded) |
| test_time | On-site test minutes (rounded) |

---

## 4. `skipped_batch` *(formerly nocomplete)*

**Purpose:** Unable-to-complete / skipped site visits.

| Column | Description |
|--------|-------------|
| utility | Utility tag |
| test_date | `yyyymmdd` |
| start_time | `HH:MM` 24-hour — e.g. `13:45` |
| map_location_id | MAP # / location |
| customer_member_id | Member / customer |
| meter_id | Meter # if known |
| drive_time | Drive minutes (from navigation timer) |
| skip_reason | Skip reason (dropdown value) |
| skip_notes | User notes only — blank if none entered |

**Note:** Saving a skipped site also creates a **mileage_expense_batch** row for odometer/utility tracking.

---

## 5. `reminders_batch` *(formerly `notes_batch`)*

**Purpose:** Personal quick-note reminders only — rows with **blank reminder text are omitted**.

| Column | Description |
|--------|-------------|
| date | `MM/DD/YY` — e.g. `06/28/26` |
| time | `HH:MM` 24-hour — e.g. `13:45` |
| reminder | Quick-note reminder text |

**Sources:** `quick_note` entries only. Field report notes, mileage notes, and skip notes export in other batches (`field_notes`, `skip_notes`, `fullbatch`).

---

## 6. `invoice_batch`

**Purpose:** Billing codes for invoicing — **completed field tests only**.

Matches canonical field tags used across the platform (see `references/csv_field_definitions.txt`).

| Column | Description |
|--------|-------------|
| utility | Utility tag |
| test_date | `yyyymmdd` |
| start_time | `HH:MM` 24-hour (time out, or time in) — e.g. `13:45` |
| location_id | MAP # / location |
| customer_member_id | Member / customer name |
| meter_id | Meter # |
| billing_code | See table below |
| billing_rate | Dollar rate |

### Billing codes

| Code | Description | Rate |
|------|-------------|------|
| **SC** | Self-contained — no CTs (2S, 12S, 14S, 15S, 16S, 25S, 16S(15S)) | $70.00 |
| **1PhCT** | 1-phase, 1 CT — e.g. 3S without PT/VT | $102.00 |
| **1PhCTPT** | 1-phase, 1 CT + PT/VT — e.g. 3S with PT | $112.00 |
| **1Ph2CT** | 1-phase, 2 CTs — 4S / 5S (45S) without PT | $107.00 |
| **1Ph2CTPT** | 1-phase, 2 CTs + PT/VT — 4S / 5S with PT | $117.00 |
| **3PhCT** | 3-phase with CTs, no PT/VT | $123.00 |
| **3PhCTPT** | 3-phase with CTs and PT/VT | **$146.00** |

**PT/VT detection (for billing):** PT/VT data entered on form, `pt_size` from master list, or **Service is center-tapped = YES** on Transformer → Site Questions.

**Center-tapped service** is billed as PT/VT tier (1PhCTPT / 1Ph2CTPT / 3PhCTPT as applicable).

**Utility surcharges:** `PETIT JEAN ELECTRIC COOPERATIVE` adds **+3%** to the base rate on every billing code (applied in `getBillingCodeAndRate(report, utility)`). Other utilities use the base table above.

---

## 7. `utility_batch`

**Purpose:** Utility company meter test import layout.

**No header row** — data rows only.

| Position | Field | Example |
|----------|-------|---------|
| 1 | **Utility tag** | `CITY OF AVA` — for office sort when multiple utilities per week; **delete this column before sending to the utility** |
| 2 | Record type | `ELEC` |
| 3 | Meter serial | meter number |
| 4 | Test date | `yyyymmdd` |
| 5 | KWh register | e.g. `00123` (zero-padded when numeric) |
| 6–8 | *(blank)* | |
| 9 | As-found full load | e.g. `100.051` |
| 10 | As-found light load | e.g. `100.173` |
| 11–13 | *(blank)* | |
| 14 | Test reason | `FT`, `FR`, or `MR` |
| 15 | Tester initials | `AWS` (default) |
| 16 | Test company | `WS` |
| 17 | *(blank)* | |
| 18 | KWh register (repeat) | same as col 5 |
| 19–21 | *(blank)* | |
| 22 | As-left full load | same as as-found (solid-state meters) |
| 23 | As-left light load | same as as-found |

Example row:

```
CITY OF AVA,ELEC,L1905560,20260617,00123,,,,100.051,100.173,,,,FT,AWS,WS,,00123,,,,100.051,100.173
```

---

## 8. `newlist_batch`

**Purpose:** Updated master list for next week — one row per **completed** site (latest visit wins if tested twice), same column layout as the downloadable master list template.

**When to use:** After field week, import/replace master list data with changes you made in WSApp (customer name, phone, meter #, service description, load type, max kW, master list notes, GPS, etc.).

| Column (exact header) | Source |
|--------|--------|
| `map_location_id` … `phone_number_2` | Same keys and order as `MASTER_TEMPLATE_FIELDS` (utility column omitted — use dashboard utility at upload) |
| `map_location_id` | `location_number` |
| `account_id` | `account_number` |
| `customer_member_id` | `customer_name` |
| `meter_id` | `meter_number` |
| `meter_form` | `form` |
| `ct_size` / `pt_size` | `ct_size` / `pt_size`, or CT1/PT1 `ratio_size` if blank |
| `list_multiplier` | `listed_multiplier` |
| `previous_kw` | `max_demand` |
| `last_test_date` | Visit date of completed test, `MM/DD/YY` (e.g. `06/28/26`) |
| `service_voltage` | T1 `secondary_voltage` (transformer nameplate) |
| `total_kva` | Sum of transformer T1 + T2 + T3 `size` (blank for Primary Service) |
| `transformer_type` | `trans_type` |
| `service_address` | `address` |
| `service_description` | `service_desc` |
| `list_notes` | `master_list_notes` (editable on Account + Navigation — separate from job Notes) |
| `phone_number_1` / `phone_number_2` | `phone` / `phone_number_2` |

**Upload CSV header order (required for template download and newlist export):**

`map_location_id, account_id, customer_member_id, meter_id, meter_form, ct_size, pt_size, list_multiplier, previous_kw, latitude, longitude, last_test_date, service_voltage, service_description, total_kva, transformer_type, service_address, service_location, load_type, list_notes, phone_number_1, phone_number_2`

**Site picker label format:** `map_location_id, customer_member_id, meter_id` (e.g. `913 SPRINGFIELD RD, BK Foods LLC, 10741388`). Upload row order is the route sequence — no route # column required. Phase is derived from `service_description` when needed (no `phase` column).

Includes **adhoc new sites** (`Add New Site` on Navigation) once the test is completed.

---

## Change log

| Date | Change |
|------|--------|
| 2026-06-17 | Initial batch export spec — 7 files, yyyymmdd + military time, invoice + utility batches added |
| 2026-06-17 | 3PhCTPT = $146; skipped batch adds drive_time; center-tapped on Site Questions |
| 2026-06-28 | Renamed `testdata_batch` → `fullbatch`; added `employee_on_site`, transformer ground flags, CT admittance low/high columns |
| 2026-06-27 | `fullbatch` (was testdata_batch): single `form`, `address`, `listed_multiplier`, `calculated_multiplier`, `latitude`/`longitude` (site GPS only — no `logged_*` or `initial_*` in CSV) |
| 2026-06-27 | `utility_batch`: column 1 = utility tag (delete before utility import); original layout shifts right by one |
| 2026-06-27 | Export: **Save JSON & Export** picker (all batches checked by default); `invoice_batch` columns reordered + `customer_name`, `meter_number`, time `HH:MM` |
| 2026-06-27 | `mileage_expense_batch`: date `MM/DD/YY`, time `HH:MM`, `reason`/`bp`/`amount` columns; location/reason rules for auto vs manual rows |
| 2026-06-28 | `notes_batch`: date `MM/DD/YY`, time `HH:MM`; blank notes skipped; quick notes export as `REMINDER` in utility/location/customer/meter columns |
| 2026-06-28 | `skipped_batch`: columns reordered; `reason` and `notes` separate; time `HH:MM`; date `yyyymmdd` |
| 2026-06-28 | `time_batch`: utility, `form`, `ct_ratio`, `pt_ratio` (CT1/PT1 `ratio_size`); time `HH:MM`; date `yyyymmdd` |
| 2026-06-28 | **v1.1.260628+**: `newlist_batch` (8th CSV); master list `Last Test Date` after lat/long; `PT Size` header; nav/account editable service desc, load type, max kW, master list notes |
| 2026-06-28 | Master list / newlist columns renamed to snake_case (`order_id`, `location_id`, `customer_member_id`, `meter_id`, …); added `phone_number_2` and `size`; site picker shows four fields |
| 2026-06-28 | **v1.1.260628**: fullbatch legacy columns removed; `socket_*`/`meter_*`/`trans_*` prefixes; transformer site checkboxes; meter bad display + socket damage via notes; Final Review required-field validation; dist package parity in `npm test` |
| 2026-06-28 | **v1.1.260628 inline-calc**: meter multiplier math source `scripts/wsapp-calculations.js` synced into `index.html`; 313 automated checks; no change to CSV column layouts |
| 2026-06-29 | **v1.2.01** — no CSV column layout changes; tooling: `sync-dropdowns`, dist prune, version bump script |
| 2026-06-29 | **v1.2.2** — no CSV column layout changes; Route Map companion added (not an export batch) |
| 2026-06-29 | **v1.3.0** — no CSV column layout changes; visual charts and vector diagrams are UI-only (not export batches) |
| 2026-07-02 | Master list / newlist: removed `order_id` column (route order = CSV row order); site picker shows location, customer, meter only |
| 2026-07-05 | Canonical CSV field names aligned across invoice, mileage, time, skipped, reminders batches; `notes_batch` → `reminders_batch`; added `references/csv_field_definitions.txt` |
| 2026-07-05 | **fullbatch** account/visit headers aligned to canonical names (`start_time`, `end_time`, `truck_id`, `location_id`, `customer_member_id`, `meter_id`, `meter_form`, `list_multiplier`, `transformer_type`, etc.); added master-list fields; removed `phase` |
| 2026-06-29 | PT/VT burden VA steps changed to **0, 25, 50, 75, 100, 125, 150, 175** (was 0, 12.5, 25, 37.5, 50, 75, 100, 200); fullbatch `pt*_va_burden_*` column headers updated to match |