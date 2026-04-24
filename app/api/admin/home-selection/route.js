export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import authAdmin from "@/middlewares/authAdmin";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    // Firebase Auth: get Bearer token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "not authorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "not authorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;
    const email = decodedToken.email;
    const isAdmin = await authAdmin(userId, email);
    if (!isAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });

    await dbConnect();
    const selections = await HomeSection.find({}).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ selections });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    // Firebase Auth: get Bearer token from header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "not authorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: "not authorized" }, { status: 401 });
    }
    const userId = decodedToken.uid;
    const email = decodedToken.email;
    const isAdmin = await authAdmin(userId, email);
    if (!isAdmin) return NextResponse.json({ error: "not authorized" }, { status: 401 });

    const body = await request.json();
    const { section, category = null, tag = null, productIds } = body || {};

    if (!section || !Array.isArray(productIds)) {
      return NextResponse.json({ error: "section and productIds are required" }, { status: 400 });
    }

    await dbConnect();
    // If an entry exists for the same section+category+tag, update it; otherwise create
    const existing = await HomeSection.findOne({
      section,
      category,
      tag,
    });

    let saved;
    if (existing) {
      saved = await HomeSection.findByIdAndUpdate(
        existing._id,
        { productIds },
        { new: true }
      );
    } else {
      saved = await HomeSection.create({ section, category, tag, productIds });
    }

    return NextResponse.json({ message: "Saved", selection: saved });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
