# FulfillMate Distribution Hub

Multi-tenant inventory and shipment management web app for operations teams. Manage customer orders, track outbound shipments, monitor inventory, process returns, and handle supplier manifests — all in one place.

**Stack:** React 18 · TypeScript · Vite · Supabase (PostgreSQL + Auth) · shadcn/ui · Tailwind CSS · TanStack Query

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <repo-url>
cd FulfillMate-Distribution-Hub
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials (found in your Supabase dashboard under **Settings → API**):

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

The anon key is safe for client-side use — Row Level Security (RLS) enforces all access control.

### 3. Apply database migrations

```bash
npx supabase db push
```

Or apply migrations manually via Supabase Studio (SQL editor) — migration files are in `supabase/migrations/`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at http://localhost:8080 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard** | KPIs, backlog, exceptions, stock alerts, shipping alerts, inbound manifests |
| **Orders** | WooCommerce order management with event log and line items |
| **Shipments** | Outbound shipment tracking (Pirate Ship / ShipStation) |
| **Inventory** | Stock levels by SKU and warehouse location with reorder alerts |
| **Stock Ledger** | Full audit trail of all stock movements and manual adjustments |
| **Returns** | Return processing with reason codes and condition tracking |
| **Exceptions** | Operational exceptions and on-hold order management |
| **Supplier Manifests** | Inbound shipment tracking with expected vs. received quantities |
| **Products** | SKU catalog with billiard cue parent/variant hierarchy support |
| **Data Intake** | CSV/XLSX import for WooCommerce orders, Pirate Ship shipments, and master XLSX |
| **Exports** | CSV exports for orders, backlog, exceptions, and inventory snapshot |

---

## Data Imports

The app auto-detects import source by inspecting file headers:

| Source | File type | Detection |
|--------|-----------|-----------|
| WooCommerce | `.csv` | `order_id`, `order_status` columns |
| Pirate Ship / ShipStation | `.csv` | `Date`, `Tracking Number`, `Name` columns |
| Master (orders + shipments) | `.xlsx` | Combined Excel format |
| SKU Framework (billiard cues) | `.xlsx` | Via **Products** page |

---

## Architecture

- **No backend server** — all data access via Supabase PostgREST with Row Level Security
- **Multi-tenant** — every table is scoped to `company_id`; users can belong to multiple companies
- **Auth** — Supabase Auth with email/password and Google OAuth; invitation system for team members
- **State** — React Query for server state, React Context for auth and company selection

See [`CLAUDE.md`](./CLAUDE.md) for full architecture details, coding conventions, and database schema reference.

---

## Deployment

### Vercel / Netlify

1. Connect your repository
2. Set the three `VITE_*` environment variables in the platform dashboard
3. Build command: `npm run build`
4. Output directory: `dist`

### Supabase Auth Redirect URLs

After deploying, add your production URL to Supabase → **Authentication → URL Configuration → Redirect URLs**:

```
https://your-domain.com/**
```

### Security checklist

- [ ] Enable **Leaked Password Protection** in Supabase → Authentication → Security
- [ ] Verify RLS is enabled on all tables (already configured in migrations)
- [ ] Add production domain to Supabase allowed redirect URLs
- [ ] Confirm `.env` is not committed (check `.gitignore`)

---

## Project Structure

```
src/
├── components/       # Shared UI components + shadcn/ui primitives
├── pages/            # One component per route
├── contexts/         # Auth and Company context providers
├── hooks/            # React Query data hooks (useSupabaseData.ts)
├── lib/              # CSV/XLSX parsers and import helpers
├── types/            # Hand-written TypeScript entity types
└── integrations/
    └── supabase/     # Supabase client + auto-generated DB types
supabase/
└── migrations/       # SQL migration history (26 files)
```
