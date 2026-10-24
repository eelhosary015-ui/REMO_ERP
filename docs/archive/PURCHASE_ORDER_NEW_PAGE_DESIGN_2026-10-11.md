# Purchase Order Creation Page UI Update — 2026-10-11

Updated the New Purchase Order modal in `src/components/Purchases.tsx` with a more polished RTL enterprise layout.

- Dark blue gradient header with icon, title, subtitle, and accessible close button.
- Grouped basic supplier/delivery/request fields in a dedicated card.
- Dedicated items card with item count, responsive horizontal table scrolling, row hover states, and a helpful empty state.
- Clear tax input section and a live summary for subtotal, calculated tax value, and grand total including tax.
- Dedicated notes card and a clearer sticky footer with a primary save action.
- Responsive sizing for smaller screens while preserving existing handlers and order creation workflow.

This is a UI-only change; purchase order business logic and API calls were intentionally left unchanged.
