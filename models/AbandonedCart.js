import mongoose from "mongoose";

const AbandonedCartSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  userId: String,
  name: { type: String, default: null },
  email: { type: String, default: null },
  phone: String,
  address: Object,
  items: Array,
  cartTotal: Number,
  currency: String,
  lastSeenAt: Date,
  source: { type: String, default: 'checkout' },
  recoveryEmailSentAt: { type: Date, default: null },
}, { timestamps: true });

// Index for better query performance
AbandonedCartSchema.index({ storeId: 1, lastSeenAt: -1 });

export default mongoose.models.AbandonedCart || mongoose.model("AbandonedCart", AbandonedCartSchema);
