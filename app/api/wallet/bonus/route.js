export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Wallet from "@/models/Wallet";
import { getAuth } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    await connectDB();
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, coins: 0, welcomeBonusClaimed: false });
    }

    if (wallet.welcomeBonusClaimed) {
      return NextResponse.json({ message: "Welcome bonus already claimed", coins: wallet.coins });
    }

    const bonusCoins = 20;
    wallet.coins = Number(wallet.coins || 0) + bonusCoins;
    wallet.welcomeBonusClaimed = true;
    wallet.transactions.push({
      type: "EARN",
      coins: bonusCoins,
      rupees: Number((bonusCoins * 1).toFixed(2)),
      orderId: "WELCOME_BONUS"
    });
    await wallet.save();

    return NextResponse.json({ message: "Welcome bonus added", coins: wallet.coins });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
