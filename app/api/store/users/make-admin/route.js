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
    const { userEmail, role } = await request.json();

    if (!userEmail || !role) {
      return NextResponse.json({ error: 'Missing userEmail or role' }, { status: 400 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Update user role
    const updated = await StoreUser.findOneAndUpdate(
      { storeId, email: userEmail },
      { role },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: `User role updated to ${role}`, user: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
