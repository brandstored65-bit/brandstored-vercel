export const dynamic = 'force-dynamic'

import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Wallet from "@/models/Wallet";

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const sellerId = decodedToken.uid;
    const storeId = await authSeller(sellerId);
    if (!storeId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { userId, amount } = await request.json();
    const coinsToAdd = Number(amount);

    if (!userId || !Number.isFinite(coinsToAdd) || coinsToAdd <= 0) {
      return NextResponse.json({ error: "Invalid wallet amount" }, { status: 400 });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { coins: coinsToAdd },
        $push: { 
          transactions: { 
            type: "ADMIN_CREDIT", 
            coins: coinsToAdd, 
            rupees: Number((coinsToAdd * 1).toFixed(2)), 
            description: "Added by store admin",
            addedBy: sellerId,
            orderId: null
          } 
        }
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({
      message: "Wallet updated",
      walletBalance: Number(wallet?.coins || 0)
    });
  } catch (error) {
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
