export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Store from "@/models/Store";

/**
 * FIX: Update all coupons to use the correct storeId
 */
export async function POST(request) {
  try {
    await connectDB();

    // Get the first store
    const store = await Store.findOne();
    
    if (!store) {
      return NextResponse.json(
        { error: "No store found" },
        { status: 404 }
      );
    }

    const correctStoreId = store._id.toString();
    console.log('Correct storeId:', correctStoreId);

    // Get all coupons
    const allCoupons = await Coupon.find({});
    console.log('Total coupons found:', allCoupons.length);

    // Update each coupon
    const updates = [];
    for (const coupon of allCoupons) {
      if (coupon.storeId !== correctStoreId) {
        console.log(`Updating coupon ${coupon.code}: ${coupon.storeId} -> ${correctStoreId}`);
        await Coupon.updateOne(
          { _id: coupon._id },
          { $set: { storeId: correctStoreId } }
        );
        updates.push({
          code: coupon.code,
          oldStoreId: coupon.storeId,
          newStoreId: correctStoreId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${updates.length} coupons`,
      correctStoreId,
      storeName: store.name,
      totalCoupons: allCoupons.length,
      updatedCoupons: updates.length,
      updates,
    });
  } catch (error) {
    console.error("Fix error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
