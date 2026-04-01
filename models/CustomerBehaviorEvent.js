import mongoose from "mongoose";

const CustomerBehaviorEventSchema = new mongoose.Schema({
  storeId: { type: String, required: true, index: true },
  visitorId: { type: String, default: "" },
  sessionId: { type: String, default: "" },
  userId: { type: String, default: "" },

  customerType: { type: String, enum: ["logged_in", "guest", "anonymous"], default: "anonymous" },
  customerKey: { type: String, default: "", index: true },
  customerName: { type: String, default: "" },
  customerEmail: { type: String, default: "" },
  customerPhone: { type: String, default: "" },
  customerAddress: { type: String, default: "" },

  eventType: {
    type: String,
    required: true,
    enum: [
      "product_view",
      "product_exit",
      "add_to_cart",
      "go_to_checkout",
      "order_placed",
      "page_view",
      "checkout_visit",
    ],
    index: true,
  },

  source: { type: String, default: "direct" },
  medium: { type: String, default: "direct" },
  campaign: { type: String, default: "none" },
  referrer: { type: String, default: "" },

  pagePath: { type: String, default: "" },
  productId: { type: String, default: "" },
  productSlug: { type: String, default: "" },
  productName: { type: String, default: "" },

  durationMs: { type: Number, default: 0 },
  scrollDepthPercent: { type: Number, default: 0 },
  nextAction: { type: String, default: "" },

  orderId: { type: String, default: "" },
  orderValue: { type: Number, default: 0 },

  eventAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

CustomerBehaviorEventSchema.index({ storeId: 1, eventAt: -1 });
CustomerBehaviorEventSchema.index({ storeId: 1, eventType: 1, eventAt: -1 });
CustomerBehaviorEventSchema.index({ storeId: 1, customerKey: 1, eventAt: -1 });
CustomerBehaviorEventSchema.index({ storeId: 1, productId: 1, eventAt: -1 });

export default mongoose.models.CustomerBehaviorEvent || mongoose.model("CustomerBehaviorEvent", CustomerBehaviorEventSchema);
