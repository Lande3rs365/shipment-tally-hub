

## Plan: Restyle Products Page to Match Shipments UX

Replace the current shadcn `Tabs` layout with the same pattern used on `ShipmentsPage`: `p-6` wrapper, header with subtitle, KPI cards, filter chips, search bar, then action buttons and content.

### Layout Structure

```text
<div className="p-6 space-y-4">
  Header: "Product Catalog" + "{n} products · SKU framework & catalogue management"
  
  KPI row (grid 2x4):
    Total SKUs (Tag, info) | Parents (Package, default) | Variants (ChevronRight, warning) | Standalone (Minus, success)
  
  Filter chips row + action buttons:
    [Overview] [Shafts (n)] [Playing Cues (n)] ... [All (n)]  ←→  [Import SKU Framework] [+ Add Product]
  
  Search bar (max-w-sm, native input matching Shipments style)
  
  Content area (Overview or category table)
</div>
```

### Key Changes

1. **Remove shadcn `Tabs`** — replace with plain `button` chips using the exact same classes from ShipmentsPage (`px-3 py-1.5 rounded-md text-xs font-medium border` with active/inactive toggle).

2. **Add KPI row** using existing `KpiCard` component with computed counts for Total, Parents, Variants, Standalone.

3. **Move Import + Add Product buttons** to sit on the right side of the filter chips row (flex justify-between), styled as outline/primary `sm` buttons matching the chip row height.

4. **Search bar** — switch from shadcn `Input` to native `input` with `max-w-sm` and the exact same classes as ShipmentsPage search.

5. **Wrap in `p-6`** — currently uses bare `space-y-4`, needs the padding wrapper.

6. **Header** — remove the Tag icon inline with h1, use plain `text-2xl font-bold` like Shipments.

7. **Table styling** — update `thead` to use `border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider` and row classes to `border-b border-border/50 hover:bg-muted/20` to match Shipments exactly. Wrap tables in `bg-card border border-border rounded-lg overflow-hidden > overflow-x-auto`.

### Files to Change

| File | Change |
|------|--------|
| `src/pages/ProductsPage.tsx` | Restyle layout: remove Tabs, add KPI row, filter chips, reposition buttons, match Shipments table classes |

