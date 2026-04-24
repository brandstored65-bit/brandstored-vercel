export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import StoreUser from "@/models/StoreUser";
import Store from "@/models/Store";
import { getAuth } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
    }

    const invite = await StoreUser.findOne({ inviteToken: token }).lean();
    if (!invite) {
      return NextResponse.json({ error: "Invalid or already used invitation" }, { status: 404 });
    }

    if (invite.inviteExpiry && new Date(invite.inviteExpiry) < new Date()) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Only enforce email match if the invitation has an email specified
    // If no email specified, allow any user to accept
    // If email specified, only allow that exact email
    if (invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      console.log('[accept-invite] Email mismatch:', { inviteEmail: invite.email, userEmail, storeId: invite.storeId });
      return NextResponse.json({ error: `This invitation is for ${invite.email}. You are signed in as ${userEmail}.` }, { status: 403 });
    }

    const updated = await StoreUser.findOneAndUpdate(
      { inviteToken: token },
      {
        status: "approved",
        userId,
        $unset: { inviteToken: "", inviteExpiry: "" },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Failed to accept invitation" }, { status: 400 });
    }

    // Note: DO NOT create a new Store for invited user
    // The invited user should be a team member accessing the owner's store
    // The StoreUser document above already links them to the storeId
    if (invite.storeId) {
      const existingStore = await Store.findById(invite.storeId);
      console.log('[accept-invite] Store for storeId:', existingStore ? 'Found' : 'Not found');
    }

    return NextResponse.json({
      message: "Invitation accepted. You now have access to the store.",
      status: "approved",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
