import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  description: String,
  email: String,
  contact: String,
  address: String,
  logo: String,
  banner: String,
  website: String,
  facebook: String,
  instagram: String,
  twitter: String,
  businessHours: String,
  returnPolicy: String,
  shippingPolicy: String,
  isActive: { type: Boolean, default: false },
  status: { type: String, default: "pending", enum: ["pending", "approved", "rejected"] },
  featuredProductIds: { type: [String], default: [] }, // Array of featured product IDs
  carouselProductIds: { type: [String], default: [] }, // Array of product IDs for carousel slider
  designSettings: { type: mongoose.Schema.Types.Mixed, default: {} }, // Home page design/appearance settings
  homeMenuCategories: {
    count: { type: Number, default: 6 },
    items: [
      {
        name: String,
        image: String,
        url: String,
        categoryId: mongoose.Schema.Types.ObjectId,
      },
    ],
  },
}, { timestamps: true });

// username already has unique index via schema field definition
StoreSchema.index({ userId: 1 });

export default mongoose.models.Store || mongoose.model("Store", StoreSchema);
