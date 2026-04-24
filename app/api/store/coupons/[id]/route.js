export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Coupon from "@/models/Coupon";
import Store from "@/models/Store";

// PUT - Update a coupon
export async function PUT(request, { params }) {
  try {
    await connectDB();
    
    // Firebase Auth
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

    // Get store
    const store = await Store.findOne({ userId }).lean();
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const { id } = params;
    const body = await request.json();

    const coupon = await Coupon.findOne({
      _id: id,
      storeId: store._id.toString(),
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Update fields
    Object.keys(body).forEach((key) => {
      if (key === "code") {
        coupon[key] = body[key].toUpperCase();
      } else if (key === "expiresAt" && body[key]) {
        coupon[key] = new Date(body[key]);
      } else {
        coupon[key] = body[key];
      }
    });

    await coupon.save();

    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return NextResponse.json(
      { error: "Failed to update coupon" },
      { status: 500 }
    );
  }
}
