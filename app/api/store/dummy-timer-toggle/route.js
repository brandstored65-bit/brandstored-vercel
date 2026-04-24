export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

// Toggle dummy countdown timer on product page for a product
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];

      if (getApps().length === 0) initializeApp({ credential: applicationDefault() });

      try {
        const decoded = await auth.verifyIdToken(idToken);
        userId = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const productId = body?.productId;
    const requestedValue = body?.value;
    const requestedMinutes = body?.minutes;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized as seller' }, { status: 401 });

    await dbConnect();

    if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
      return NextResponse.json({ error: 'Product ID required or invalid format' }, { status: 400 });
    }

    const objectId = new mongoose.Types.ObjectId(productId);

    const product = await Product.collection.findOne(
      { _id: objectId },
      {
        projection: {
          _id: 1,
          storeId: 1,
          enableDummyCountdown: 1,
          dummyCountdownMinutes: 1,
        },
      }
    );

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (product.storeId !== storeId) {
      return NextResponse.json({ error: 'Unauthorized to modify this product' }, { status: 403 });
    }

    const current = typeof product.enableDummyCountdown === 'boolean' ? product.enableDummyCountdown : false;
    const newVal = typeof requestedValue === 'boolean' ? requestedValue : !current;

    const updateData = { enableDummyCountdown: newVal };

    if (typeof requestedMinutes === 'number' && Number.isFinite(requestedMinutes)) {
      updateData.dummyCountdownMinutes = Math.max(1, Math.min(1440, Math.round(requestedMinutes)));
    } else if (newVal && (!Number.isFinite(Number(product.dummyCountdownMinutes)) || Number(product.dummyCountdownMinutes) <= 0)) {
      updateData.dummyCountdownMinutes = 30;
    }

    const updateResult = await Product.collection.updateOne(
      { _id: objectId },
      { $set: updateData }
    );

    if (!updateResult.matchedCount) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updated = await Product.collection.findOne(
      { _id: objectId },
      {
        projection: {
          _id: 1,
          enableDummyCountdown: 1,
          dummyCountdownMinutes: 1,
        },
      }
    );

    return NextResponse.json({
      message: newVal ? 'Dummy timer enabled' : 'Dummy timer disabled',
      enableDummyCountdown: newVal,
      previous: current,
      product: updated,
    });
  } catch (error) {
    console.error('Error toggling dummy timer:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
