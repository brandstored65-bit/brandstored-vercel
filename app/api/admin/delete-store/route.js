export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import Store from '@/models/Store';
import Order from '@/models/Order';
import Product from '@/models/Product';
import ReturnRequest from '@/models/ReturnRequest';
import authAdmin from '@/middlewares/authAdmin';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Firebase Auth: Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[DELETE STORE] Token verification failed:', e.message);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = decodedToken.uid;
    const email = decodedToken.email;
    const isAdmin = await authAdmin(userId, email);
    if (!isAdmin) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    await dbConnect();
    const { storeId } = await request.json();
    if (!storeId) {
      return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
    }

    // Delete all return requests for this store
    await ReturnRequest.deleteMany({ storeId });
    // Delete all orders for this store
    await Order.deleteMany({ storeId });
    // Delete all products for this store
    await Product.deleteMany({ storeId });
    // Delete the store itself
    await Store.findByIdAndDelete(storeId);

    return NextResponse.json({ message: 'Store and all related products/orders deleted.' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete store.' }, { status: 500 });
  }
}
