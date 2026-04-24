export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { auth } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    await dbConnect();
    const { name, image, email } = await request.json();
    await User.findOneAndUpdate(
      { firebaseUid: userId },
      { name, image, email },
      { upsert: true }
    );
    return NextResponse.json({ message: 'Profile updated' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
