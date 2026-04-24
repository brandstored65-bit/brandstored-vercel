export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';
import authSeller from '@/middlewares/authSeller';
import { auth } from "@/lib/firebase-admin";

export async function GET(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Resolve storeId for owners or team members
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Fetch approved users
    const users = await StoreUser.find({
      storeId: storeId,
      status: 'approved'
    }).lean();

    // Fetch pending invites
    const pending = await StoreUser.find({
      storeId: storeId,
      status: { $in: ['invited', 'pending'] }
    }).lean();

    return NextResponse.json({
      users: users.map(u => ({ ...u, id: u._id.toString(), _id: u._id.toString() })),
      pending: pending.map(p => ({ ...p, id: p._id.toString(), _id: p._id.toString() }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
