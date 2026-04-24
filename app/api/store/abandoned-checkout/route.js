export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AbandonedCart from '@/models/AbandonedCart';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { auth } from "@/lib/firebase-admin";

const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const buildOrderIdentifierSet = (orders) => {
  const identifiers = new Set();

  orders.forEach((order) => {
    if (order?.userId) identifiers.add(`user:${String(order.userId)}`);

    const emails = [order?.guestEmail, order?.shippingAddress?.email]
      .map(normalizeIdentifier)
      .filter(Boolean);
    emails.forEach((email) => identifiers.add(`email:${email}`));

    const phones = [order?.guestPhone, order?.shippingAddress?.phone]
      .map(normalizePhone)
      .filter(Boolean);
    phones.forEach((phone) => identifiers.add(`phone:${phone}`));
  });

  return identifiers;
};

const getCartIdentifiers = (cart) => {
  const identifiers = [];

  if (cart?.userId) identifiers.push(`user:${String(cart.userId)}`);

  const email = normalizeIdentifier(cart?.email);
  if (email) identifiers.push(`email:${email}`);

  const phone = normalizePhone(cart?.phone);
  if (phone) identifiers.push(`phone:${phone}`);

  return identifiers;
};

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();
    const unrecoveredCarts = await AbandonedCart.find({ storeId, recoveredAt: null })
      .sort({ lastSeenAt: -1, updatedAt: -1 })
      .lean();

    if (unrecoveredCarts.length > 0) {
      const orders = await Order.find({ storeId })
        .select('userId guestEmail guestPhone shippingAddress.email shippingAddress.phone createdAt')
        .lean();

      const orderIdentifiers = buildOrderIdentifierSet(orders);
      const recoveredCartIds = unrecoveredCarts
        .filter((cart) => getCartIdentifiers(cart).some((identifier) => orderIdentifiers.has(identifier)))
        .map((cart) => cart._id);

      if (recoveredCartIds.length > 0) {
        await AbandonedCart.updateMany(
          { _id: { $in: recoveredCartIds }, storeId, recoveredAt: null },
          {
            $set: {
              recoveredAt: new Date(),
            }
          }
        );
      }
    }

    const carts = await AbandonedCart.find({ storeId, recoveredAt: null })
      .sort({ lastSeenAt: -1, updatedAt: -1 })
      .lean();

    return NextResponse.json({ carts: carts.map(c => ({ ...c, _id: String(c._id) })) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const cartId = String(body?.cartId || '').trim();
    const cartIds = Array.isArray(body?.cartIds)
      ? body.cartIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    if (!cartId && cartIds.length === 0) {
      return NextResponse.json({ error: 'cartId or cartIds is required' }, { status: 400 });
    }

    await dbConnect();

    if (cartIds.length > 0) {
      const result = await AbandonedCart.deleteMany({
        _id: { $in: cartIds },
        storeId,
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount || 0,
        message: `${result.deletedCount || 0} abandoned checkout entr${result.deletedCount === 1 ? 'y' : 'ies'} deleted`,
      });
    }

    const deleted = await AbandonedCart.findOneAndDelete({
      _id: cartId,
      storeId,
    }).lean();

    if (!deleted) {
      return NextResponse.json({ error: 'Abandoned checkout not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Abandoned checkout deleted' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
