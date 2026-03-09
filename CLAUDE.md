# CLAUDE.md — Shipment Tally Hub

AI assistant guide for understanding and working in this codebase.

---

## Project Overview

**Shipment Tally Hub** is a multi-tenant inventory and shipment management web application. It enables businesses to:

- Manage customer orders (WooCommerce integration)
- Track outbound shipments (Pirate Ship / ShipStation)
- Manage inventory levels, stock movements, and alerts
- Track inbound supplier/manufacturer manifests
- Process product returns
- Handle operational exceptions and on-hold orders
- Import data via CSV/XLSX files with auto-detection
- Manage product/SKU catalogs including billiard cue hierarchies (parent/variant)

**Architecture:** Client-side React app backed by Supabase (PostgreSQL + Auth). No dedicated backend server — all data access is via Supabase PostgREST APIs with Row Level Security (RLS).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.8 |
| Framework | React 18.3 |
| Build Tool | Vite 5.4 (SWC compiler) |
| Routing | React Router DOM 6 |
| Server State | TanStack React Query 5 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS 3.4 |
| Forms | React Hook Form 7 + Zod 3 |
| Database/Auth | Supabase (@supabase/supabase-js 2) |
| CSV Parsing | PapaParse 5 |
| Excel Parsing | XLSX 0.18 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Toasts | Sonner |
| Testing | Vitest 3 + Testing Library |

---

## Directory Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components (40+ files, DO NOT hand-edit)
│   ├── AppLayout.tsx          # Main app shell with sidebar
│   ├── AppSidebar.tsx         # Navigation sidebar + company switcher
│   ├── ErrorBoundary.tsx      # Class component catching React errors; shows reload UI
│   ├── ProtectedRoute.tsx     # Auth guard (redirects to /login if no session)
│   ├── CompanyGate.tsx        # Redirects to /onboarding if no company
│   ├── InviteMemberDialog.tsx # Invite team members dialog
│   ├── KpiCard.tsx            # Dashboard KPI stat card
│   ├── NavLink.tsx            # Wrapper around React Router NavLink with active/pending class support
│   ├── StatusBadge.tsx        # Colored status pill
│   ├── EmptyState.tsx         # Zero-data placeholder
│   └── LoadingSpinner.tsx
├── pages/                     # One component per route
│   ├── Dashboard.tsx          # Main KPI dashboard
│   ├── OrdersPage.tsx
│   ├── OrderDetailPage.tsx
│   ├── ShipmentsPage.tsx
│   ├── InventoryPage.tsx
│   ├── StockMovementsPage.tsx
│   ├── SupplierManifestsPage.tsx
│   ├── ReturnsPage.tsx
│   ├── ExceptionsPage.tsx
│   ├── AdjustmentsPage.tsx
│   ├── ProductsPage.tsx       # SKU catalog management (filtering, display)
│   ├── UploadsPage.tsx        # CSV/XLSX data intake
│   ├── ExportsPage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── OnboardingPage.tsx     # First-time company creation
│   ├── AcceptInvitePage.tsx
│   ├── Index.tsx              # Unused fallback redirect page
│   └── NotFound.tsx
├── contexts/
│   ├── AuthContext.tsx         # Supabase session + signOut
│   └── CompanyContext.tsx      # Multi-tenant: companies[], currentCompany
├── hooks/
│   ├── useSupabaseData.ts      # 15+ React Query hooks for all data fetching
│   ├── use-toast.ts
│   └── use-mobile.tsx
├── integrations/
│   ├── supabase/
│   │   ├── client.ts           # Typed Supabase client (uses env vars)
│   │   └── types.ts            # AUTO-GENERATED — do not manually edit
│   └── lovable/
│       └── index.ts            # Google/Apple OAuth via Lovable
├── lib/
│   ├── utils.ts                # cn() Tailwind class utility
│   ├── csvParsers.ts           # WooCommerce, Pirate Ship, XLSX parsers
│   ├── importHelpers.ts        # Import execution + preview functions
│   └── skuFrameworkParser.ts   # XLSX parser for billiard cue SKU framework (parent/variant hierarchy)
├── types/
│   └── database.ts             # Hand-written TypeScript types for DB entities
├── data/
│   └── mockData.ts             # Static mock data structures
├── test/
│   ├── components/
│   │   └── uiComponents.test.tsx
│   ├── integration/
│   │   ├── auth.test.tsx
│   │   └── hooks.test.tsx
│   ├── unit/
│   │   └── skuFrameworkParser.test.ts
│   ├── setup.ts                # Vitest setup (jest-dom + matchMedia mock)
│   ├── example.test.ts
│   ├── csvParsers.test.ts
│   ├── importHelpers.test.ts
│   └── utils.test.ts
├── App.tsx                     # Router, providers, route definitions
├── main.tsx                    # React root
└── index.css                   # Global styles + Tailwind directives
supabase/
├── migrations/                 # 22 SQL migration files (timestamped)
└── config.toml                 # Supabase project config
```

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/App.tsx` | All route definitions; wraps app in providers (outermost: ErrorBoundary) |
| `src/contexts/AuthContext.tsx` | `useAuth()` — session, user, signOut |
| `src/contexts/CompanyContext.tsx` | `useCompany()` — companies, currentCompany, setCurrentCompany |
| `src/hooks/useSupabaseData.ts` | All data-fetching hooks (React Query) |
| `src/lib/csvParsers.ts` | CSV/XLSX parsing logic per source type |
| `src/lib/importHelpers.ts` | Batch import/update logic for orders and shipments |
| `src/lib/skuFrameworkParser.ts` | XLSX parser for billiard cue SKU hierarchy (v12 format) |
| `src/integrations/supabase/client.ts` | Supabase client instance (import from here) |
| `src/integrations/supabase/types.ts` | Auto-generated DB types (do not edit) |
| `src/types/database.ts` | Hand-written entity types and join types |
| `supabase/migrations/` | SQL schema history (22 files) |

---

## Development Commands

```bash
npm run dev          # Start dev server (http://localhost:8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build locally
npm run lint         # ESLint check
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

---

## Environment Variables

Required in `.env` (Vite prefix `VITE_` makes them client-accessible):

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-id>
```

These are loaded in `src/integrations/supabase/client.ts`. Never commit secrets — the anon key is safe for client use (RLS enforces access control).

---

## Architecture Patterns

### Multi-Tenancy

Every database table with user data includes a `company_id` column. All queries **must** be filtered by the current company. Use the `useCompanyQuery()` factory in `useSupabaseData.ts`:

```typescript
// Pattern for company-scoped queries
const { data } = useQuery({
  queryKey: ['orders', currentCompany?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('company_id', currentCompany.id);
    return data;
  },
  enabled: !!currentCompany?.id,
});
```

### Authentication Flow

1. `AuthContext` wraps the app and listens to `supabase.auth.onAuthStateChange`
2. `ProtectedRoute` redirects to `/login` if no session
3. `CompanyGate` redirects to `/onboarding` if user has no companies
4. After onboarding, `CompanyContext` persists selected company to `localStorage` (`distrohub_company_id`)

### Provider Hierarchy (App.tsx)

From outermost to innermost:
```
ErrorBoundary
  QueryClientProvider
    TooltipProvider
      Toaster (Radix) + Toaster (Sonner)
        BrowserRouter
          AuthProvider
            CompanyProvider
              Routes
```

### Data Fetching

All server state is managed with **React Query**. Custom hooks live in `src/hooks/useSupabaseData.ts`:

```typescript
// Using a data hook in a component
import { useOrders } from '@/hooks/useSupabaseData';

const { data: orders, isLoading, error } = useOrders();
```

**Available query hooks:**
- `useOrders()` — Paginated orders with items
- `useOrder(orderId)` — Single order by order_number
- `useOrderEvents(orderId)` — Event log for a specific order
- `useOrderShipments(orderId)` — Shipments for a specific order
- `useInventory()` — All inventory with product and location relations
- `useStockMovements()` — Stock movement history
- `useStockMovementsByProduct(productId)` — Last 10 movements for a product
- `useShipments()` — All shipments with order details
- `useReturns()` — All returns with linked order numbers
- `useManufacturerManifests()` — Inbound manifests with items
- `useExceptions()` — Open exceptions with linked order info
- `useProducts()` — Active products ordered by SKU
- `useStockLocations()` — Active warehouse locations
- `useDataIntakeLogs()` — CSV/XLSX import history
- `useDashboardStats()` — Comprehensive dashboard aggregates

**Available mutation hooks:**
- `useImportSkuFramework()` — Bulk import billiard cue SKU framework XLSX with parent/variant hierarchy resolution

**Factory:**
- `useCompanyQuery<T>()` — Generic company-scoped query factory

### CSV/XLSX Import Pipeline

1. User uploads file on `UploadsPage`
2. `csvParsers.ts` auto-detects the source format by inspecting column headers:
   - WooCommerce CSV: `order_id`, `order_status` columns
   - Pirate Ship CSV: `Date`, `Tracking Number`, `Name` columns
   - Master XLSX: Combined orders + shipments in a single Excel file
3. `importHelpers.ts` previews changes (new vs. updated record counts)
4. On confirmation, bulk upserts are executed via Supabase

### SKU Framework Import Pipeline (`skuFrameworkParser.ts`)

Handles billiard cue product hierarchies from proprietary XLSX files:

- Auto-detects header rows
- Supports multiple product categories: shafts, playing cues, break cues, jump cues, cases, accessories, apparel
- Resolves parent/variant product relationships from SKU prefixes
- Supports v12 product format with `model`/`variant` row types
- Invoked via `useImportSkuFramework()` mutation hook

### State Management Pattern

- **Global:** React Context for auth and company state
- **Server:** React Query (caching, refetching, invalidation)
- **Local:** `useState` / `useReducer` for UI state
- **Form:** React Hook Form + Zod validation

---

## Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | User display name, avatar |
| `companies` | Tenant companies |
| `user_companies` | User ↔ Company membership (role: owner/admin/member) |
| `products` | SKU catalog (unit_cost, sale_price, reorder_point) |
| `orders` | Customer orders (status, woo_status, financial totals) |
| `order_items` | Line items for orders (product_id, qty, price) |
| `shipments` | Outbound shipments (tracking, carrier, weight, dates) |
| `shipment_items` | Line items for shipments |
| `manufacturer_manifests` | Inbound supplier shipments (ETA, request_date) |
| `manufacturer_manifest_items` | Line items (expected_qty, received_qty, damaged_qty) |
| `returns` | Returns (reason, condition, refund_amount) |
| `inventory` | Stock levels by product + location (on_hand, available, reserved, allocated, damaged) |
| `stock_locations` | Warehouse/bin locations (location_type) |
| `stock_movements` | Audit trail of inventory changes (direction, movement_type) |
| `order_events` | Event log for orders (import, status changes) |
| `exceptions` | Operational issues (on-hold orders, inventory alerts) |
| `data_intake_logs` | CSV/XLSX upload history |
| `invitations` | Pending user invitations (invite_code, token, expires_at) |

### Database Functions

| Function | Purpose |
|---|---|
| `create_company_with_owner()` | Create company and assign owner role atomically |
| `accept_invitation_by_code()` | Accept an invite via short code |
| `accept_invitation_by_token()` | Accept an invite via URL token |
| `get_user_company_ids()` | Get all company IDs for a user (used in RLS) |
| `user_belongs_to_company()` | Check membership (used in RLS policies) |
| `handle_new_user()` | Trigger: auto-create profile on signup |
| `update_updated_at_column()` | Trigger: auto-update `updated_at` timestamps |

### RLS (Row Level Security)

All tables have RLS enabled. Access is gated via:
- User must be authenticated
- User must be a member of the company (`user_belongs_to_company()`)

Never disable RLS or bypass it. Always include `company_id` in inserts.

---

## Coding Conventions

### File & Naming

- **Components:** `PascalCase.tsx` (e.g., `OrderDetailPage.tsx`)
- **Hooks:** `use[Name].ts` (e.g., `useSupabaseData.ts`)
- **Utilities:** `camelCase.ts` (e.g., `csvParsers.ts`)
- **Database fields:** `snake_case` (mirrors Postgres column names)
- **TypeScript types/interfaces:** `PascalCase`

### TypeScript

- `tsconfig.app.json` has `noImplicitAny: false` — loose typing is allowed but avoid `any` where possible
- Prefer explicit return types on exported functions
- Use the generated types from `supabase/types.ts` for DB operations; use `types/database.ts` for UI-layer types
- Zod schemas are defined inline in page components alongside their forms

### Components

- Use functional components with hooks only
- Use `const` for all declarations (no `function` keyword for components)
- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind classes
- Prefer shadcn/ui primitives over custom HTML for interactive elements
- Use `useToast()` (Sonner) for user feedback, not `alert()`

```typescript
// Good — using cn() for conditional classes
<div className={cn("p-4", isActive && "bg-blue-100", className)}>
```

### Data Fetching

- All new queries should follow the React Query pattern in `useSupabaseData.ts`
- Always include `enabled: !!currentCompany?.id` to prevent queries before company is loaded
- Use `queryClient.invalidateQueries()` after mutations to refresh data
- Error handling: log to console + show toast notification

### Error Handling

```typescript
try {
  const { data, error } = await supabase.from('orders').insert(payload);
  if (error) throw error;
  toast({ title: 'Success', description: 'Order created' });
} catch (err) {
  console.error('Failed to create order:', err);
  toast({ title: 'Error', description: 'Failed to create order', variant: 'destructive' });
}
```

### Imports

Use path alias `@/` for `src/`:

```typescript
import { useOrders } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
```

---

## shadcn/ui Components

Components live in `src/components/ui/`. They are managed by the shadcn CLI — **do not manually edit** these files unless making intentional customizations.

To add a new shadcn component:
```bash
npx shadcn-ui@latest add <component-name>
```

Configuration is in `components.json` (style: `default`, base color: `slate`, CSS variables: enabled).

---

## Testing

Tests use **Vitest** with **Testing Library**.

- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Run: `npm run test`
- Setup: `src/test/setup.ts` (includes `@testing-library/jest-dom` matchers and `window.matchMedia` mock)
- Use `describe` / `it` / `expect` globally (configured in `vitest.config.ts`)

**Test organization:**
- `src/test/unit/` — Pure unit tests (e.g., `skuFrameworkParser.test.ts`)
- `src/test/integration/` — Integration tests for hooks and auth (e.g., `hooks.test.tsx`, `auth.test.tsx`)
- `src/test/components/` — Component rendering tests (e.g., `uiComponents.test.tsx`)
- `src/test/` (root) — General tests (`csvParsers.test.ts`, `importHelpers.test.ts`, `utils.test.ts`)

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

---

## Common Tasks

### Add a new data entity

1. Create a SQL migration in `supabase/migrations/` following existing naming convention
2. Run `supabase db push` or apply via Supabase Studio
3. Regenerate types: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
4. Add hand-written type to `src/types/database.ts`
5. Add a React Query hook to `src/hooks/useSupabaseData.ts`
6. Create a page in `src/pages/` and register it in `src/App.tsx`
7. Add navigation item in `src/components/AppSidebar.tsx`

### Add a new CSV import source

1. Add a parser function in `src/lib/csvParsers.ts`
2. Update the auto-detection logic (column header inspection)
3. Add an import helper in `src/lib/importHelpers.ts`
4. Update `UploadsPage.tsx` to handle the new source

### Add a new shadcn component

```bash
npx shadcn-ui@latest add <component>
```

### Invite a user to a company

Use the `InviteMemberDialog` component or call `supabase.from('invitations').insert(...)` directly. The `accept_invitation_by_code()` / `accept_invitation_by_token()` DB functions handle acceptance.

---

## Known Security Items

### Leaked Password Protection (requires Supabase Dashboard — not fixable via SQL)

Supabase's security advisor flags that **Leaked Password Protection** is disabled. This feature
checks new passwords against the HaveIBeenPwned database and rejects compromised ones.

**To enable:**
1. Open the Supabase Dashboard for this project
2. Go to **Authentication → Security**
3. Toggle on **"Check passwords against HaveIBeenPwned"**

This cannot be configured via SQL migrations — it is a platform-level Auth setting.

### companies INSERT policy (resolved in migration `20260309120559`)

Supabase's security advisor previously flagged the `companies` INSERT policy as "always true"
(`WITH CHECK (true)`). This policy has been **dropped** — it was unnecessary because:

- Company creation goes exclusively through the `create_company_with_owner()` RPC function
  (`OnboardingPage.tsx` line 83)
- That function is `SECURITY DEFINER`, so it **bypasses RLS entirely** — no INSERT policy is
  needed or evaluated
- No client code path does a direct `INSERT INTO companies`

**Do not re-add an INSERT policy on `companies`** unless a new client-side direct-insert flow
is introduced, in which case `WITH CHECK (auth.uid() IS NOT NULL)` is the minimum; `WITH CHECK (true)`
must be avoided.

---

## DO NOT

- Edit `src/integrations/supabase/types.ts` manually — it is auto-generated
- Disable or bypass RLS policies
- Store sensitive data in `localStorage` beyond `company_id`
- Use `var` — always use `const` or `let`
- Use `alert()` or `confirm()` — use Sonner toast or shadcn Dialog
- Commit `.env` files or secrets
- Add backend server code — this is a pure client app (Supabase handles the backend)
- Manually edit files in `src/components/ui/` unless intentionally customizing shadcn components

---

## Git Workflow

- Active development branch: `claude/claude-md-mmifm76zvvhk9ffu-Ia6cW`
- Main branch: `master`
- Commit style: short, descriptive imperative messages (e.g., `Fix shipment status mapping`)
- Push: `git push -u origin <branch-name>`
