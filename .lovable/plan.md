

## Plan: Import Master Distribution Hub Data & Refine Upload Flow

### What I understood from your spreadsheet and requirements

1. **Your XLSX has the real data** — the "All Orders Master" tab (~700+ orders from Jan-Mar 2026) is your single source of truth, plus the Pirate Ship shipment CSV (249 rows) contains live tracking data.

2. **No historical/backorder data needed** — we skip pre-Dec 2025 legacy orders and backorder tabs entirely. Clean start going forward.

3. **Weekly/monthly KPI reset** — dashboard stats should show current week and current month metrics, not cumulative all-time totals.

4. **On-hold orders = exceptions** — orders with `on-hold` WooCommerce status should surface in the exceptions queue with reason tracking and follow-up accountability.

5. **Daily import with update confirmation** — when you upload a new CSV, the system should show what will be created vs updated, and ask you to confirm before overwriting.

6. **Accountability & notes** — you liked the daily structure, audit trail, and notes from the spreadsheet. Orders should have activity logs and contact/follow-up tracking.

---

### Implementation Plan

#### 1. Fix Pirate Ship CSV parser (header mismatch)

The attached `Shipments.csv` is a **Pirate Ship export** with these actual headers:

```
Order ID, Created Date, Recipient, Company, Email, Tracking Number,
Cost, Status, Insured Value, Insurance Type, Batch, Label Size,
Saved Package, Ship From, Ship Date, Estimated Delivery Time,
Weight (oz), Zone, Package Type, Package Length/Width/Height,
Tracking Status, Tracking Info, Tracking Date, Country, Carrier,
Service, Order Value, Source
```

The current `parseShipmentCSV` expects different headers (from the earlier conversation). I'll update it to map:
- `order_id` → `order_number`
- `recipient` → `customer_name`
- `email` → customer email
- `ship_date` → shipped date
- `tracking_number`, `carrier`, `service` → as-is
- `tracking_status` → mapped to internal status (`"In Transit"`, `"Delivered"`, `"New label, not scanned yet"`)
- `cost` → shipping cost
- `order_value` → order total
- `country` → shipping country
- `weight_(oz)` → weight in grams (converted)

#### 2. Add XLSX support for the master order tab

The master hub XLSX "All Orders Master" tab (Page 3 in the parsed doc) has columns:
```
Order# | Order Date | WOO Status | Order Total | Customer Name |
Items | shipping_country | Tracking Number | Carrier | Service |
Tracking Status | Tracking Date | Est Delivery | Cost
```

This is the same structure as the shipment-aware order format. I'll add an XLSX parser (using a lightweight library like `xlsx`/SheetJS) or parse it as CSV from the XLSX. This single tab contains both order AND shipment data merged together — the import logic will:
- Create/update orders from each row
- If tracking number exists, also create/update shipments linked to the order
- Map `on-hold` WooCommerce status to exceptions automatically

#### 3. Import preview & update confirmation

Before importing, show a summary screen:
- **New orders**: X rows (will be created)
- **Updated orders**: Y rows (already exist, will be overwritten)
- **New shipments**: Z rows
- **Updated shipments**: W rows
- "Confirm Import" / "Cancel" buttons

This addresses your requirement: *"when we import daily reports — obviously we need to confirm whether we would like to replace XXX with the update info."*

#### 4. Weekly/Monthly KPI reset on Dashboard

Modify `useDashboardStats` to:
- Add date filters for "this week" (Mon-Sun) and "this month"
- Add a toggle on the dashboard: **This Week** | **This Month** | **All Time**
- KPIs show filtered counts (orders received, shipped, exceptions, etc.)
- Chart shows daily breakdown within the selected period

#### 5. On-hold → Exceptions pipeline

When orders are imported with `woo_status = 'on-hold'`:
- Auto-create an exception record with `exception_type = 'on_hold'`
- Include the order items and customer info in the exception description
- Track follow-up status: "customer contacted?", "department chased?"
- Weekly follow-up reminder flag (your rule: *"all woo orders the customer is contacted / Department chased solution 1 x pw"*)

#### 6. Order activity log & notes

Add a notes/activity system to orders:
- Use the existing `order_events` table for structured events (status changes, imports)
- Add a new `order_notes` concept (either a new table or use `order_events` with `event_type = 'note'`)
- On the order detail page, show a timeline of all events and notes
- Support "WOO note updated", "Customer contacted", "Department chased" log entries

---

### Technical details

**New dependency**: `xlsx` (SheetJS) for parsing `.xlsx` files client-side.

**Database changes**: 
- None required for the core import — existing tables cover orders, shipments, exceptions, and order_events
- May add a `follow_up_due_at` column to exceptions for the weekly chase requirement

**Files to modify**:
- `src/lib/csvParsers.ts` — fix Pirate Ship header mapping, add XLSX parser
- `src/pages/UploadsPage.tsx` — add import preview step, XLSX file support, confirmation dialog
- `src/hooks/useSupabaseData.ts` — add date-filtered dashboard stats query
- `src/pages/Dashboard.tsx` — add week/month toggle for KPIs
- `src/pages/OrderDetailPage.tsx` — add notes/activity timeline
- `src/pages/ExceptionsPage.tsx` — show on-hold orders with follow-up tracking

