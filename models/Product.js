import mongoose from "mongoose";

const productSchemaDefinition = {
  name: String,
  slug: { type: String, unique: true },
  description: String,
  shortDescription: String,
  AED: Number,
  price: Number,
  costPrice: { type: Number, default: 0 }, // Actual cost/purchase price for profit calculation
  images: [String],
  category: { type: String, ref: 'Category' },
  categories: { type: [String], default: [] }, // Multiple categories support
  sku: String,
  inStock: { type: Boolean, default: true },
  stockQuantity: { type: Number, default: 0 },
  hasVariants: { type: Boolean, default: false },
  variants: { type: Array, default: [] },
  attributes: { type: Object, default: {} },
  hasBulkPricing: { type: Boolean, default: false },
  bulkPricing: { type: Array, default: [] },
  fastDelivery: { type: Boolean, default: false },
  freeShippingEligible: { type: Boolean, default: false },
  allowReturn: { type: Boolean, default: true },
  allowReplacement: { type: Boolean, default: true },
  // Payment options per-product
  codEnabled: { type: Boolean, default: true }, // allow Cash On Delivery for this product
  onlinePaymentEnabled: { type: Boolean, default: true }, // allow online payments (card/stripe/razorpay)
  imageAspectRatio: { type: String, default: '1:1' },
  storeId: String,
  tags: { type: [String], default: [] },
  // Frequently Bought Together fields
  enableFBT: { type: Boolean, default: false },
  fbtProductIds: { type: [String], default: [] },
  fbtBundlePrice: { type: Number, default: null },
  fbtBundleDiscount: { type: Number, default: null },
  // Checkout offer fields (separate from FBT)
  enableCheckoutOffer: { type: Boolean, default: false },
  checkoutOfferProductId: { type: String, default: '' },
  checkoutOfferDiscountPercent: { type: Number, default: null },
  // Dummy countdown timer for product page urgency display
  enableDummyCountdown: { type: Boolean, default: false },
  dummyCountdownMinutes: { type: Number, default: 30 },
};

const ProductSchema = new mongoose.Schema(productSchemaDefinition, { timestamps: true });

// Add indexes for better query performance
ProductSchema.index({ inStock: 1, createdAt: -1 });
ProductSchema.index({ storeId: 1, inStock: 1 });
ProductSchema.index({ category: 1, inStock: 1 }); // For category filtering
ProductSchema.index({ price: 1, AED: 1 }); // For discount calculations and price sorting
ProductSchema.index({ tags: 1, inStock: 1 }); // For tag-based filtering
ProductSchema.index({ fastDelivery: 1, inStock: 1 }); // For fast delivery filter

const existingProductModel = mongoose.models.Product;

if (existingProductModel) {
  const missingFields = Object.fromEntries(
    Object.entries(productSchemaDefinition).filter(([fieldName]) => !existingProductModel.schema.path(fieldName))
  );

  if (Object.keys(missingFields).length > 0) {
    existingProductModel.schema.add(missingFields);
  }
}

export default existingProductModel || mongoose.model("Product", ProductSchema);