export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Store from "@/models/Store";

// GET - Fetch all coupons for a store
export async function GET(request) {
  try {
    await connectDB();
    
    // Firebase Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault() });
    }
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // Get store
    const store = await Store.findOne({ userId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const coupons = await Coupon.find({ storeId: store._id.toString() })
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return NextResponse.json(
      { error: "Failed to fetch coupons" },
      { status: 500 }
    );
  }
}

// POST - Create a new coupon
export async function POST(request) {
  try {
    await connectDB();
    
    // Firebase Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault() });
    }
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // Get store
    const store = await Store.findOne({ userId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      code,
      title,
      description,
      discount,
      discountType,
      discountValue,
      minOrderValue,
      minPrice,
      maxDiscount,
      maxUses,
      usageLimit,
      maxUsesPerUser,
      expiresAt,
      savingsAmount,
      badgeColor,
      specificProducts,
      forNewUser,
      forMember,
      firstOrderOnly,
      oneTimePerUser,
      isPublic,
      minProductCount,
    } = body;

    // Support both old and new schema
    const finalCode = code;
    const finalTitle = title || `${discount || discountValue}${discountType === 'percentage' ? '% Off' : ' Off'}`;
    const finalDescription = description || `Get discount on your order`;
    const finalDiscountType = discountType || 'percentage';
    const finalDiscountValue = discountValue || discount;
    
    if (!finalCode || !finalDiscountValue) {
      return NextResponse.json(
        { error: "Missing required fields: code and discount value" },
        { status: 400 }
      );
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({
      code: finalCode.toUpperCase(),
      storeId: store._id.toString(),
    });

    if (existingCoupon) {
      return NextResponse.json(
        { error: "Coupon code already exists" },
        { status: 400 }
      );
    }

    const coupon = await Coupon.create({
      code: finalCode.toUpperCase(),
      title: finalTitle,
      description: finalDescription,
      storeId: store._id.toString(),
      discountType: finalDiscountType,
      discountValue: parseFloat(finalDiscountValue),
      minOrderValue: parseFloat(minOrderValue || minPrice || 0),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : undefined,
      maxUses: maxUses || usageLimit ? parseInt(maxUses || usageLimit) : undefined,
      maxUsesPerUser: maxUsesPerUser || (oneTimePerUser ? 1 : undefined),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      savingsAmount,
      badgeColor: badgeColor || "green",
      isActive: true,
      isPublic: isPublic !== undefined ? isPublic : true,
      // Old schema fields for compatibility
      discount: parseFloat(finalDiscountValue),
      minPrice: parseFloat(minOrderValue || minPrice || 0),
      minProductCount: minProductCount ? parseInt(minProductCount) : undefined,
      specificProducts: specificProducts || [],
      forNewUser: forNewUser || false,
      forMember: forMember || false,
      firstOrderOnly: firstOrderOnly || false,
      oneTimePerUser: oneTimePerUser || false,
      usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
    });

    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return NextResponse.json(
      { error: "Failed to create coupon" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a coupon
export async function DELETE(request) {
  try {
    await connectDB();
    
    // Firebase Auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault() });
    }
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;

    // Get store
    const store = await Store.findOne({ userId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const couponId = searchParams.get("id");

    if (!couponId) {
      return NextResponse.json(
        { error: "Coupon ID is required" },
        { status: 400 }
      );
    }

    const coupon = await Coupon.findOneAndDelete({
      _id: couponId,
      storeId: store._id.toString(),
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Coupon deleted" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return NextResponse.json(
      { error: "Failed to delete coupon" },
      { status: 500 }
    );
  }
}
