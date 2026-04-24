export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import AbandonedCart from '@/models/AbandonedCart';

export async function POST(request) {
  try {
    const body = await request.json();
    const { items, guestEmail, guestPhone, guestName } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    // Guest cart must have at least email or phone to track
    const email = guestEmail?.toLowerCase()?.trim() || null;
    const phone = guestPhone?.trim() || null;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required for guest cart tracking' }, { status: 400 });
    }

    await dbConnect();

    const productIds = items.map(it => it.productId || it.id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id storeId name price')
      .lean();

    const productMap = new Map(products.map(p => [String(p._id), p]));

    // Group items by storeId
    const grouped = new Map();
    for (const it of items) {
      const productId = String(it.productId || it.id);
      const prod = productMap.get(productId);
      if (!prod?.storeId) continue;

      const storeId = String(prod.storeId);
      if (!grouped.has(storeId)) grouped.set(storeId, []);

      grouped.get(storeId).push({
        productId: String(prod._id),
        name: it.name || prod.name,
        quantity: it.quantity || 1,
        price: it.price || prod.price || 0,
        variantOptions: it.variantOptions || null,
      });
    }

    const now = new Date();

    // Save guest cart to each store
    for (const [storeId, storeItems] of grouped.entries()) {
      const filter = {
        storeId,
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      };

      await AbandonedCart.updateOne(
        filter,
        {
          $set: {
            storeId,
            userId: null,
            name: guestName?.trim() || null,
            email,
            phone,
            address: null,
            items: storeItems,
            cartTotal: null,
            currency: null,
            lastSeenAt: now,
            source: 'guest-cart',
          },
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ ok: true, message: 'Guest cart tracked' });
  } catch (error) {
    console.error('[guest-abandoned-cart] error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
