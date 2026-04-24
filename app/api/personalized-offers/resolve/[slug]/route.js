export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PersonalizedOffer from "@/models/PersonalizedOffer";
import Product from "@/models/Product";

// GET: Resolve latest active personalized offer by product slug
export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { slug } = params;

    if (!slug) {
      return NextResponse.json(
        { error: "Product slug is required" },
        { status: 400 }
      );
    }

    const product = await Product.findOne({ slug })
      .select('_id name slug price mrp AED images description category inStock stockQuantity')
      .lean();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    // Pick the most recent valid active offer for this product
    const offer = await PersonalizedOffer.findOne({
      productId: String(product._id),
      isActive: true,
      isUsed: false,
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!offer) {
      return NextResponse.json(
        { error: "No active offer found for this product" },
        { status: 404 }
      );
    }

    const discountAmount = (product.price * offer.discountPercent) / 100;
    const discountedPrice = Math.round((product.price - discountAmount) * 100) / 100;
    const savings = Math.round(discountAmount * 100) / 100;
    const timeRemaining = new Date(offer.expiresAt) - now;

    return NextResponse.json({
      success: true,
      valid: true,
      expired: false,
      used: false,
      offer: {
        id: offer._id,
        offerToken: offer.offerToken,
        customerEmail: offer.customerEmail,
        customerName: offer.customerName,
        discountPercent: offer.discountPercent,
        expiresAt: offer.expiresAt,
        isActive: offer.isActive,
        isUsed: offer.isUsed,
        timeRemaining,
        notes: offer.notes
      },
      product: {
        id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDescription: product.shortDescription,
        images: product.images,
        originalPrice: product.price,
        AED: product.AED,
        discountedPrice,
        savings,
        discountPercent: offer.discountPercent,
        category: product.category,
        categories: product.categories,
        inStock: product.inStock,
        stockQuantity: product.stockQuantity,
        sku: product.sku,
        hasVariants: product.hasVariants,
        variants: product.variants,
        attributes: product.attributes,
        hasBulkPricing: product.hasBulkPricing,
        bulkPricing: product.bulkPricing,
        fastDelivery: product.fastDelivery,
        allowReturn: product.allowReturn,
        allowReplacement: product.allowReplacement,
        imageAspectRatio: product.imageAspectRatio || '1:1'
      }
    });
  } catch (error) {
    console.error("Error resolving offer by slug:", error);
    return NextResponse.json(
      { error: "Failed to resolve offer", details: error.message },
      { status: 500 }
    );
  }
}
