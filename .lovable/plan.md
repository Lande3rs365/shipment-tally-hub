

## Reorder Sidebar Navigation

Update the `navItems` array in `src/components/AppSidebar.tsx` to match your preferred sequence. Also rename "Supplier Inbound" to "Manufacturer Inbound".

### New order:
1. Dashboard
2. Exceptions
3. Orders
4. Shipments
5. Returns
6. Manufacturer Inbound (renamed)
7. Inventory
8. Stock Ledger
9. Adjustments
10. Data Intake
11. Exports

### Change
Single edit to `src/components/AppSidebar.tsx` — reorder the `navItems` array and update the label from "Supplier Inbound" to "Manufacturer Inbound".

