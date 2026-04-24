export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Order from "@/models/Order";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";


// Verify coupon
export async function POST(request){
    try {
        // Firebase Auth: get Bearer token from header
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;
        // TODO: Implement hasPlusPlan logic if needed

        await dbConnect();
        const { code, cartTotal, productIds, storeId } = await request.json();

        const coupon = await Coupon.findOne({
            code: code.toUpperCase(),
            expiresAt: { $gt: new Date() },
            isActive: true
        });

        if (!coupon) {
            return NextResponse.json({ error: "Coupon not found or expired" }, { status: 404 });
        }

        // Check if coupon belongs to the store (if store-specific)
        if (coupon.storeId && storeId && coupon.storeId !== storeId) {
            return NextResponse.json({ error: "This coupon is not valid for this store" }, { status: 400 });
        }

        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
        }

        // Check if for new users only
        if (coupon.forNewUser) {
            const userOrders = await Order.find({ userId }).lean();
            if (userOrders.length > 0) {
                return NextResponse.json({ error: "Coupon valid for new users only" }, { status: 400 });
            }
        }

        // Check if for first order only
        if (coupon.firstOrderOnly) {
            const storeOrders = coupon.storeId
                ? await Order.find({ userId, storeId: coupon.storeId }).lean()
                : await Order.find({ userId }).lean();
            if (storeOrders.length > 0) {
                return NextResponse.json({ error: "Coupon valid for first order only" }, { status: 400 });
            }
        }

        // Check if one time per user
        if (coupon.oneTimePerUser) {
            const usedOrders = await Order.find({
                userId,
                isCouponUsed: true,
                'coupon.code': coupon.code
            });
            if (usedOrders.length > 0) {
                return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
            }
        }

        // Check for member-only coupon (placeholder, always false)
        if (coupon.forMember) {
            // TODO: Implement actual member check logic
            const hasPlusPlan = false;
            if (!hasPlusPlan) {
                return NextResponse.json({ error: "Coupon valid for members only" }, { status: 400 });
            }
        }

        // Check minimum price
        if (cartTotal && coupon.minPrice > 0 && cartTotal < coupon.minPrice) {
            return NextResponse.json({
                error: `Minimum cart value of AED${coupon.minPrice} required`
            }, { status: 400 });
        }

        // Check minimum product count
        if (productIds && coupon.minProductCount && productIds.length < coupon.minProductCount) {
            return NextResponse.json({
                error: `Minimum ${coupon.minProductCount} products required`
            }, { status: 400 });
        }

        // Check specific products
        if (coupon.specificProducts && coupon.specificProducts.length > 0 && productIds) {
            const hasValidProduct = productIds.some(id => coupon.specificProducts.includes(id));
            if (!hasValidProduct) {
                return NextResponse.json({
                    error: "This coupon is not valid for the products in your cart"
                }, { status: 400 });
            }
        }

        return NextResponse.json({ coupon });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
