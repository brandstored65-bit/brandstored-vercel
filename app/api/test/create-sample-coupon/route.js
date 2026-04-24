export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Store from "@/models/Store";

/**
 * DEVELOPMENT ONLY - Creates sample coupons for testing
 * Remove this endpoint in production
 */
export async function POST(request) {
  try {
    await connectDB();

    // Get the first store
    const store = await Store.findOne();
    
    if (!store) {
      return NextResponse.json(
        { error: "No store found. Please create a store first." },
        { status: 404 }
      );
    }

    const storeId = store._id.toString();
    console.log('Creating sample coupons for store:', storeId);

    // Create sample coupons
    const sampleCoupons = [
      {
        code: "WELCOME10",
        title: "Welcome 10% Off",
        description: "Get 10% off on your first order",
        storeId,
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 500,
        maxDiscount: 500,
        maxUses: 100,
        maxUsesPerUser: 1,
        isActive: true,
        badgeColor: "green",
      },
      {
        code: "SAVE50",
        title: "Save AED50",
        description: "Flat AED50 off on orders above AED1000",
        storeId,
        discountType: "fixed",
        discountValue: 50,
        minOrderValue: 1000,
        maxUses: 50,
        isActive: true,
        badgeColor: "orange",
      },
      {
        code: "MEGA20",
        title: "Mega 20% Discount",
        description: "20% off on all products this week",
        storeId,
        discountType: "percentage",
        discountValue: 20,
        minOrderValue: 0,
        maxDiscount: 1000,
        maxUses: 200,
        isActive: true,
        badgeColor: "blue",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    ];

    // Delete existing test coupons
    await Coupon.deleteMany({ 
      code: { $in: ["WELCOME10", "SAVE50", "MEGA20"] },
      storeId 
    });

    // Create new coupons
    const createdCoupons = await Coupon.insertMany(sampleCoupons);

    console.log(`Created ${createdCoupons.length} sample coupons`);

    return NextResponse.json({
      success: true,
      message: `Created ${createdCoupons.length} sample coupons`,
      storeId,
      coupons: createdCoupons.map(c => ({
        code: c.code,
        title: c.title,
        discount: `${c.discountType === 'percentage' ? c.discountValue + '%' : 'AED' + c.discountValue}`,
      })),
    });
  } catch (error) {
    console.error("Error creating sample coupons:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create sample coupons" },
      { status: 500 }
    );
  }
}

// GET - Check if sample coupons exist
export async function GET(request) {
  try {
    await connectDB();

    const store = await Store.findOne();
    if (!store) {
      return NextResponse.json(
        { error: "No store found" },
        { status: 404 }
      );
    }

    const coupons = await Coupon.find({ 
      storeId: store._id.toString(),
      code: { $in: ["WELCOME10", "SAVE50", "MEGA20"] }
    }).lean();

    return NextResponse.json({
      storeId: store._id.toString(),
      sampleCouponsExist: coupons.length > 0,
      sampleCouponCount: coupons.length,
      coupons,
    });
  } catch (error) {
    console.error("Error checking sample coupons:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
