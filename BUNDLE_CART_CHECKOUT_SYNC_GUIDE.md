# Bundle Cart & Checkout Sync Guide

This document explains the exact bundle logic added to fix:
- wrong totals in cart/checkout for bundle products,
- bundle quantity mismatch between product page and checkout,
- `+/-` bundle tier switching,
- quantity above highest bundle tier (switch to normal per-unit mode).

---

## 1) Core Rule (Most Important)

### Price storage model
- For bundle tiers, `price` is stored as **bundle total**.
  - Example: Buy 2 price = `199.9` means total for 2, not per unit.
- For non-bundle mode (qty above highest tier), `price` is stored as **per-unit**.

### Correct line total formula
Use this everywhere (cart totals, checkout totals, coupon validation totals):

```js
const computeLineTotal = (price, quantity, bundleQty) => {
  const numericPrice = Number(price) || 0;
  const numericQty = Number(quantity) || 0;
  const numericBundleQty = Number(bundleQty) || 0;
  if (numericBundleQty > 1) {
    return (numericPrice / numericBundleQty) * numericQty;
  }
  return numericPrice * numericQty;
};
```

Why:
- Bundle item (Buy 2): `(199.9 / 2) * 2 = 199.9` ✅
- Non-bundle qty 4 at 119.9: `119.9 * 4` ✅

---

## 2) Data Shape Expected in Cart

Each cart entry supports:

```js
cartItems[productId] = {
  quantity,
  price,
  variantOptions: {
    color,
    size,
    bundleQty // number for bundle mode, null for non-bundle mode
  },
  offerToken,
  discountPercent
}
```

Bundle mode:
- `variantOptions.bundleQty = 1|2|3...`
- `price = bundle total`

Non-bundle mode (above top tier):
- `variantOptions.bundleQty = null`
- `price = per-unit base price`

---

## 3) Product Page Logic

In `handleOrderNow` / `handleAddToCart`:
- Add item in loop `qty` times (because reducer increments by 1 each dispatch).
- Pass `price: effPrice` (bundle total when tier selected).
- Pass selected `bundleQty` inside `variantOptions`.

Also for stock cap on selected bundle variant:
- available units = `variant.stock * selectedBundleQty` (if bundleQty > 1)

---

## 4) Counter Logic (Tier Navigation + Above-Top-Tier)

Implemented in `components/Counter.jsx`.

### Inputs required
- `bulkVariants` (all bundle variants sorted by `options.bundleQty`)
- `baseUnitPrice` (lowest tier per-unit price)

### Required helpers
- `switchToBundle(targetBundle)`
  - clear current product row from cart,
  - re-add `targetBundleQty` times,
  - each add uses `price = targetBundle.price` and `bundleQty = targetBundleQty`.

- `switchToNonBundle(newQty)`
  - clear current row,
  - re-add `newQty` times,
  - each add uses `price = baseUnitPrice` and `bundleQty = null`.

### `+` behavior
- In bundle mode:
  - if not highest tier -> next bundle tier,
  - if highest tier -> switch to non-bundle with qty = highestBundleQty + 1.
- In non-bundle mode -> normal increment by 1.

### `-` behavior
- In bundle mode:
  - if lowest tier -> remove item,
  - else -> previous bundle tier.
- In non-bundle mode:
  - if `qty - 1` equals a bundle tier -> snap back to that bundle tier,
  - else decrement normally,
  - if reaches 0 -> remove item.

---

## 5) Cart Page Logic

In cart page mapping:
1. Resolve variant-aware price (`resolveCartUnitPrice`).
2. Compute totals with `computeLineTotal(price, qty, bundleQty)`.
3. Pass `baseUnitPrice` into `Counter`.

### `baseUnitPrice` derivation
```js
const sortedBvs = [...bulkVariants].sort((a, b) => Number(a.options.bundleQty) - Number(b.options.bundleQty));
const lowestTier = sortedBvs[0];
const baseUnitPrice = lowestTier
  ? Number(lowestTier.price) / Math.max(1, Number(lowestTier.options.bundleQty))
  : Number(item.price ?? 0);
```

---

## 6) Checkout Page Logic

In checkout cart controls:
- Add `baseUnitPrice` to display item model.
- Add:
  - `switchCheckoutBundle(...)`
  - `switchCheckoutToNonBundle(...)`
- `handleIncreaseCartQty`:
  - at highest bundle tier -> `switchCheckoutToNonBundle(highestQty + 1)`.
- `handleDecreaseCartQty`:
  - in non-bundle mode, if `qty-1` matches tier -> switch back to that bundle.

### `+` disabled rule
For bundle products, do **not** disable at highest tier, because user can go to non-bundle mode above highest tier.

---

## 7) Where This Was Applied

- `components/Counter.jsx`
- `app/(public)/cart/page.jsx`
- `app/(public)/checkout/CheckoutPageUI.jsx`
- `components/ProductDetails.jsx`

---

## 8) Validation Checklist

1. Select Buy 2 on product page -> cart/checkout quantity = 2 and total = bundle total.
2. Press `+` from Buy 1 -> Buy 2 -> Buy 3 tiers correctly.
3. Press `-` from Buy 3 -> Buy 2 -> Buy 1.
4. Press `+` at highest tier (e.g. Buy 3) -> qty 4 non-bundle mode with base unit price.
5. Press `-` from qty 4 -> snaps back to Buy 3 tier.
6. Coupon and subtotal calculations match display totals.

---

## 9) Common Mistakes to Avoid

- ❌ Using `price * qty` for bundle rows.
- ❌ Treating variant `stock` as total units when bundleQty > 1.
- ❌ Disabling `+` at highest bundle tier.
- ❌ Keeping `bundleQty` set when switching to non-bundle mode.

---

## 10) Optional Stability Guard (Cart Empty Race)

If your cart sometimes appears empty due to server/local sync race:
- In cart fetch fulfilled reducer, avoid replacing non-empty local cart with empty server cart.
- In cart UI, avoid deleting cart keys just because product list is temporarily missing data.

This was also fixed in this codebase for intermittent empty-cart behavior.
