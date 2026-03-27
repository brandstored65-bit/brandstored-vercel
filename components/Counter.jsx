'use client'
import { addToCart, removeFromCart, deleteItemFromCart } from "@/lib/features/cart/cartSlice";
import { useDispatch, useSelector } from "react-redux";

// bulkVariants: array of variant objects with options.bundleQty and price fields
// baseUnitPrice: per-unit price used when qty exceeds the highest bundle tier
const Counter = ({ productId, maxQty, bulkVariants = [], baseUnitPrice }) => {

    const { cartItems } = useSelector(state => state.cart);
    const dispatch = useDispatch();

    const entry = cartItems[productId];
    const quantity = typeof entry === 'number' ? entry : entry?.quantity || 0;
    const price = typeof entry === 'object' ? entry?.price : undefined;
    const variantOptions = typeof entry === 'object' ? entry?.variantOptions : undefined;
    const offerToken = typeof entry === 'object' ? entry?.offerToken : undefined;
    const discountPercent = typeof entry === 'object' ? entry?.discountPercent : undefined;

    // Bundle tier logic
    const isBundleProduct = bulkVariants.length > 0;
    const sortedBundles = isBundleProduct
        ? [...bulkVariants].sort((a, b) => Number(a.options.bundleQty) - Number(b.options.bundleQty))
        : [];
    const currentBundleQty = Number(variantOptions?.bundleQty) || 0;
    const isInBundleMode = isBundleProduct && currentBundleQty > 0;
    const currentBundleIndex = isInBundleMode
        ? sortedBundles.findIndex(v => Number(v.options.bundleQty) === currentBundleQty)
        : -1;
    const isAtLowestBundle = isInBundleMode && currentBundleIndex <= 0;
    const isAtHighestBundle = isInBundleMode && currentBundleIndex >= sortedBundles.length - 1;

    const normalizedMaxQty = typeof maxQty === 'number' ? Math.max(0, maxQty) : null;
    // Bundle products can always go up (to next tier or beyond into non-bundle mode)
    const canIncrement = isBundleProduct
        ? true
        : (normalizedMaxQty === null ? true : quantity < normalizedMaxQty);

    // Per-unit price for the non-bundle mode (qty above highest bundle)
    const resolvedUnitPrice = baseUnitPrice
        ?? (sortedBundles.length > 0
            ? Number(sortedBundles[0].price) / Math.max(1, Number(sortedBundles[0].options.bundleQty))
            : Number(price || 0));

    // Replace current cart entry with a different bundle tier
    const switchToBundle = (targetBundle) => {
        const targetQty = Number(targetBundle.options.bundleQty);
        const targetPrice = Number(targetBundle.price);
        dispatch(deleteItemFromCart({ productId }));
        for (let i = 0; i < targetQty; i++) {
            dispatch(addToCart({
                productId,
                price: targetPrice,
                variantOptions: { ...variantOptions, bundleQty: targetQty },
                ...(offerToken !== undefined ? { offerToken } : {}),
                ...(discountPercent !== undefined ? { discountPercent } : {}),
            }));
        }
    };

    // Switch to non-bundle mode: qty exceeds highest bundle, use per-unit price
    const switchToNonBundle = (newQty) => {
        dispatch(deleteItemFromCart({ productId }));
        for (let i = 0; i < newQty; i++) {
            dispatch(addToCart({
                productId,
                price: resolvedUnitPrice,
                // Keep color/size but clear bundleQty so it's treated as regular qty
                variantOptions: variantOptions ? { ...variantOptions, bundleQty: null } : undefined,
                ...(offerToken !== undefined ? { offerToken } : {}),
                ...(discountPercent !== undefined ? { discountPercent } : {}),
            }));
        }
    };

    const addToCartHandler = () => {
        if (!canIncrement) return;
        if (isInBundleMode) {
            if (isAtHighestBundle) {
                // Go beyond top bundle → non-bundle mode, qty = highestBundleQty + 1
                const highestQty = Number(sortedBundles[sortedBundles.length - 1].options.bundleQty);
                switchToNonBundle(highestQty + 1);
            } else {
                switchToBundle(sortedBundles[currentBundleIndex + 1]);
            }
        } else {
            // Non-bundle mode: increment qty by 1 keeping stored unit price
            dispatch(addToCart({
                productId,
                ...(price !== undefined ? { price } : {}),
                ...(variantOptions !== undefined ? { variantOptions } : {}),
                ...(offerToken !== undefined ? { offerToken } : {}),
                ...(discountPercent !== undefined ? { discountPercent } : {}),
                ...(normalizedMaxQty !== null ? { maxQty: normalizedMaxQty } : {}),
            }));
        }
    };

    const removeFromCartHandler = () => {
        if (isInBundleMode) {
            if (isAtLowestBundle) {
                dispatch(deleteItemFromCart({ productId }));
            } else {
                switchToBundle(sortedBundles[currentBundleIndex - 1]);
            }
        } else {
            // Non-bundle mode: check if qty-1 snaps back to a bundle tier
            const newQty = quantity - 1;
            if (isBundleProduct && newQty > 0) {
                const matchingBundle = sortedBundles.find(b => Number(b.options.bundleQty) === newQty);
                if (matchingBundle) {
                    switchToBundle(matchingBundle);
                    return;
                }
            }
            if (newQty <= 0) {
                dispatch(deleteItemFromCart({ productId }));
            } else {
                dispatch(removeFromCart({ productId }));
            }
        }
    };

    return (
        <div className="inline-flex items-center gap-1 sm:gap-3 px-3 py-1 rounded border border-slate-200 max-sm:text-sm text-slate-600">
            <button onClick={removeFromCartHandler} className="p-1 select-none">-</button>
            <p className="p-1">{quantity}</p>
            <button
                onClick={addToCartHandler}
                disabled={!canIncrement}
                className={`p-1 select-none ${!canIncrement ? 'opacity-40 cursor-not-allowed' : ''}`}
            >+
            </button>
        </div>
    );
}

export default Counter