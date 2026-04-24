export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";
import authAdmin from "@/middlewares/authAdmin";

// GET: list all selections (admin)
export async function GET() {
  // Firebase Auth: get Bearer token from header (GET has no req, so use globalThis.request)
  const request = globalThis.request || {};
  const authHeader = request.headers?.get?.("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.split(" ")[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = decodedToken.uid;
  const email = decodedToken.email;
  const isAdmin = await authAdmin(userId, email);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const selections = await HomeSection.find({}).sort({ sortOrder: 1 }).lean();
  return NextResponse.json({ selections });
}

// POST: create a new selection (admin)
export async function POST(req) {
  // Firebase Auth: get Bearer token from header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.split(" ")[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = decodedToken.uid;
  const email = decodedToken.email;
  const isAdmin = await authAdmin(userId, email);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const body = await req.json();
    const {
      section = "custom",
      title = "Untitled Section",
      subtitle,
      productIds = [],
      slides = [],
      bannerCtaText,
      bannerCtaLink,
      layout = "deals_with_banner",
      isActive = true,
      sortOrder = 0,
    } = body;

    const created = await HomeSection.create({
      section,
      title,
      subtitle,
      productIds,
      slides,
      bannerCtaText,
      bannerCtaLink,
      layout,
      isActive,
      sortOrder,
    });

    return NextResponse.json({ selection: created });
  } catch (error) {
    console.error("Create home selection error", error);
    return NextResponse.json({ error: "Failed to create selection" }, { status: 500 });
  }
}
