# FulfillMate

### Operations Control for Ecommerce Distribution

FulfillMate is an operations control hub for ecommerce fulfilment teams.

It connects orders, shipments, inventory, returns, supplier inbound deliveries, and operational exceptions into a single system — replacing the spreadsheets, inboxes, and disconnected tools that most distribution teams rely on today.

The goal is simple:

**Give operations teams one place to see what is happening and what needs attention.**

---

# What FulfillMate Does

FulfillMate sits between your sales channels, warehouses, carriers, and customer service workflows.

Instead of jumping between platforms, your team works from a single operational system that tracks:

- orders
- shipments
- returns
- inventory
- supplier inbound deliveries
- operational exceptions

---

# Core Modules

## Dashboard
The operational control panel.

Shows real-time visibility across:

- orders received
- shipments dispatched
- returns pending
- operational exceptions
- inventory alerts
- inbound supplier deliveries

---

## Orders
Centralized order tracking across connected sales channels.

Each order record includes:

- line items
- shipment linkage
- status history
- operational notes

---

## Shipments
Track outbound fulfilment activity and delivery status.

Monitor:

- tracking numbers
- carrier updates
- delayed shipments
- fulfilment workflow progress

---

## Exceptions
Automatically surfaces operational issues such as:

- missing shipment records
- incorrect shipping details
- fulfilment blockers
- stock inconsistencies

---

## Returns
Structured returns and warranty workflow including:

- return reason
- product condition
- resolution outcome
- inventory impact

---

## Manufacturer Inbound
Tracks supplier and manufacturer shipments arriving into the warehouse.

Helps teams reconcile:

- expected deliveries
- partial shipments
- inbound stock discrepancies

---

## Inventory
Real-time stock visibility across products and warehouse locations.

Includes:

- stock levels
- stock alerts
- availability tracking

---

## Stock Ledger
Full audit trail of stock movements including:

- adjustments
- order allocations
- returns
- supplier inbound receipts

---

# Data Imports

FulfillMate includes a structured data intake pipeline for importing operational data.

Supported imports include:

- WooCommerce order exports
- ShipStation shipment exports
- Pirate Ship CSV exports
- master reconciliation spreadsheets
- SKU frameworks

Each import runs through:

1. file detection  
2. preview validation  
3. structured mapping  
4. safe database ingestion  

This prevents broken data from entering the operational system.

---

# AI Agent (Planned)

FulfillMate is evolving into an **AI-assisted operations platform**.

The upcoming FulfillMate AI Agent will automate operational workflows such as:

- chasing missing tracking numbers
- sending customer shipping updates
- detecting fulfilment anomalies
- generating end-of-day operations summaries
- linking support conversations to orders

---

# Integration Roadmap

### Phase 1 — Core Operations
- WooCommerce sync
- Shopify sync
- EasyPost tracking
- customer notification automation
- stock alerts

### Phase 2 — Marketplace Integration
- Amazon
- eBay
- TikTok Shop
- automated tracking chase
- operational messaging summaries

### Phase 3 — Back Office Automation
- Xero
- QuickBooks
- MYOB
- Klaviyo
- Mailchimp
- support ticket linking

### Phase 4 — AI Operations Agent
- automated fulfilment monitoring
- operational summaries
- reconciliation automation
- workflow orchestration

---

# Technology Stack

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

State & Data

- TanStack Query
- React Hook Form
- Zod

Backend

- Supabase
- PostgreSQL
- Row Level Security

Data Processing

- PapaParse
- XLSX

---

# Multi-Tenant Architecture

FulfillMate supports multiple companies inside the same platform.

Each company’s data is isolated using `company_id`, allowing distribution groups, agencies, or multi-brand businesses to operate within the same system.

---

# Development Setup

Clone the repo:

```bash
git clone <repo-url>
cd FulfillMate-Distribution-Hub
npm install
