# Frequent Product Showing Guide (FBT)

## Purpose
This document explains how the Frequent Product Showing feature works (Frequently Bought Together / FBT), how it is configured, how it appears on product pages, and how to test it.

## What This Feature Does
- Shows related products on a product details page.
- Lets customers select multiple related items.
- Calculates bundle total automatically.
- Adds selected products to cart in one action.

## Where It Is Configured
- Admin page: /admin/products/fbt
- Store admin can:
  - Enable/disable frequent products for a main product.
  - Select related products.
  - Set fixed bundle price OR discount percentage.

## Where It Is Displayed
- Customer page: product details page.
- UI section appears only when:
  - FBT is enabled for that product.
  - Related products exist and are fetchable.

## Core Files
- UI (Customer): components/ProductDetails.jsx
- API: app/api/products/[id]/fbt/route.js
- Admin UI: app/admin/products/fbt/page.jsx
- Product model: models/Product.js
- Prisma schema: prisma/schema.prisma

## Data Fields
Main product includes:
- enableFBT: boolean
- fbtProductIds: string[]
- fbtBundlePrice: number | null
- fbtBundleDiscount: number | null

## Pricing Logic
Order of precedence:
1. If fixed bundle price exists, use it.
2. Else if discount exists, calculate discounted total.
3. Else use sum of selected product prices.

Formula:
- baseTotal = mainProduct + selectedRelatedProducts
- finalTotal = fixedPrice OR (baseTotal - discount%) OR baseTotal

## Customer Flow
1. Customer opens product page.
2. Frequent Product Showing section loads (if enabled).
3. Customer checks/unchecks related products.
4. Total updates live.
5. Customer clicks Add Bundle to Cart.
6. Main item + selected related items are added to cart.

## Cart Behavior
- Each selected item is added as separate cart line.
- Variant options (if present) are preserved.
- Quantity and price should remain consistent with cart format.

## Edge Cases
- Related product missing/out of stock: skip or disable selection.
- Related product with invalid price: exclude from final total and log warning.
- No related products returned: hide section gracefully.
- Fixed price and discount both set: fixed price should win.

## UI Recommendations
- Keep section below core product info.
- Show clear savings amount when discount/fixed bundle gives benefit.
- Highlight selected count and final total.
- Keep mobile layout compact and readable.

## API Expectations
GET /api/products/[id]/fbt
- Returns:
  - Main product FBT config
  - Resolved related products with price/name/image/availability

PATCH /api/products/[id]/fbt
- Accepts:
  - enableFBT
  - fbtProductIds
  - fbtBundlePrice
  - fbtBundleDiscount

## Validation Rules
- fbtProductIds should not include main product ID.
- Max recommended related items: 3 to 6.
- Discount range recommended: 0 to 50.
- Bundle price should not be negative.

## Testing Checklist
- Admin can enable and save FBT.
- Admin can add/remove related items.
- Product page shows section only when enabled.
- Total changes correctly on select/unselect.
- Fixed price override works.
- Discount calculation works.
- Add bundle adds all selected items to cart.
- Works for logged-in and guest user.
- Works on mobile and desktop.

## Analytics Suggestions
Track events:
- fbt_viewed
- fbt_item_selected
- fbt_item_unselected
- fbt_add_bundle_clicked
- fbt_add_bundle_success

Useful dimensions:
- mainProductId
- selectedCount
- finalBundleValue
- hasFixedPrice
- hasDiscount

## Known Follow-Up Improvements
- Add conversion metrics dashboard for FBT.
- Add AI/heuristic auto-suggestion for related products.
- Add stock-aware automatic replacement for unavailable related items.
- Add A/B testing on section placement and CTA text.
