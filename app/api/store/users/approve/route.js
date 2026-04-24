export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import StoreUser from '@/models/StoreUser';
import authSeller from '@/middlewares/authSeller';
import { auth } from "@/lib/firebase-admin";

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Approve the user
    const updated = await StoreUser.findOneAndUpdate(
      { storeId, email: userEmail },
      { status: 'approved', approvedById: userId },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User approved successfully', user: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
