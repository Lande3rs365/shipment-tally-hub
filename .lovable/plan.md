

## Plan: Promote AI Agent to Standalone Page + Navigation Reorder

### Changes

**1. New file: `src/pages/AIAgentPage.tsx`**
- Extract the `AIAgentComingSoon` component from SettingsPage into its own page
- Add a duplicate of the "Want early access?" CTA card as a **section divider** between Core Capabilities and Integration Roadmap — same visual style (dashed border, sparkles icon, "Get Early Access" button) acting as a page breather
- The bottom CTA stays as-is, so the page has two CTA touchpoints

**2. Update `src/pages/SettingsPage.tsx`**
- Remove the `AIAgentComingSoon` function and its tab trigger/content
- Remove the `ai-agent` tab from the TabsList

**3. Update `src/components/AppSidebar.tsx`**
- Reorder `navItems` to business-flow order:
  - Dashboard → Orders → Exceptions → Shipments → Returns → Manufacturer Inbound → Products → Inventory → Stock Ledger
- Add a visual separator line before a new "AI Agent" nav entry (with `Bot` icon and animated ping dot)
- Settings remains last

**4. Update `src/App.tsx`**
- Add `/ai-agent` route pointing to the new page
- Add redirect from `/settings?tab=ai-agent` → `/ai-agent`

**5. Update `src/components/MobileBottomTabs.tsx`**
- If AI Agent should appear in mobile tabs, add it there too (or keep it sidebar-only — will follow existing mobile tab pattern)

### Page structure (AIAgentPage)

```text
Hero banner
How it connects (3-step flow)
Core Capabilities (3×3 grid)
── CTA divider: "Want early access?" + Get Early Access button ──
Integration Roadmap (2×2 phase grid)
Bottom CTA card (same style, repeated)
```

### Sidebar order

```text
Dashboard
Orders
Exceptions
Shipments
Returns
Manufacturer Inbound
Products
Inventory
Stock Ledger
─── separator ───
AI Agent  (with ping dot)
Settings
```

