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
    const coinsToDeduct = Number(amount);

    if (!userId || !Number.isFinite(coinsToDeduct) || coinsToDeduct <= 0) {
      return NextResponse.json({ error: "Invalid deduction amount" }, { status: 400 });
    }

    // Check current balance
    const wallet = await Wallet.findOne({ userId }).lean();
    if (!wallet || wallet.coins < coinsToDeduct) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { coins: -coinsToDeduct },
        $push: {
          transactions: {
            type: "ADMIN_DEDUCT",
            coins: coinsToDeduct,
            rupees: Number((coinsToDeduct * 1).toFixed(2)),
            description: "Deducted by store admin",
            addedBy: sellerId,
            orderId: null
          }
        }
      },
      { new: true }
    ).lean();

    return NextResponse.json({
      message: "Wallet deducted",
      walletBalance: Number(updatedWallet?.coins || 0)
    });
  } catch (error) {
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
