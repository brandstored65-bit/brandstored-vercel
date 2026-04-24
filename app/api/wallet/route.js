export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Wallet from "@/models/Wallet";
import { getAuth } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    // Ensure project id env vars exist before token verification
    if ((!process.env.GCLOUD_PROJECT || !process.env.GOOGLE_CLOUD_PROJECT) && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (serviceAccount?.project_id) {
          if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = serviceAccount.project_id;
          if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
        }
      } catch {
        // ignore here; getAuth/verify will surface a clear error if config is invalid
      }
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;

    await connectDB();
    let wallet = await Wallet.findOne({ userId }).lean();

    if (!wallet) {
      wallet = await Wallet.create({ userId, coins: 0 });
    }

    const coins = Number(wallet.coins || 0);
    const rupeesValue = Number((coins * 1).toFixed(2));

    return NextResponse.json({
      coins,
      rupeesValue,
      transactions: wallet.transactions || []
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
