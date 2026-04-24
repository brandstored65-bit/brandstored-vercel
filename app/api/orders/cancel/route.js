export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { sendOrderStatusEmail } from '@/lib/email';

const CANCELLABLE_STATUSES = new Set([
  'ORDER_PLACED',
  'CONFIRMED',
  'PROCESSING',
  'PICKUP_REQUESTED',
  'WAITING_FOR_PICKUP',
]);

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    const body = await req.json();
    const orderId = body?.orderId;
    const reason = String(body?.reason || '').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isOwner = String(order.userId || '') === String(userId) || (decoded?.email && order.guestEmail === decoded.email);
    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const currentStatus = String(order.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED') {
      return NextResponse.json({ error: 'Order already cancelled' }, { status: 400 });
    }

    if (!CANCELLABLE_STATUSES.has(currentStatus)) {
      return NextResponse.json({ error: `Order cannot be cancelled at ${currentStatus} stage` }, { status: 400 });
    }

    order.status = 'CANCELLED';
    if (reason) {
      order.cancelReason = reason;
    }
    await order.save();

    // Restock product quantities for cancelled order
    for (const item of order.orderItems || []) {
      const productId = item?.productId;
      const qty = Number(item?.quantity) || 0;
      if (!productId || qty <= 0) continue;

      try {
        const updated = await Product.findByIdAndUpdate(
          productId,
          { $inc: { stockQuantity: qty } },
          { new: true }
        );

        if (updated) {
          const hasStock = (typeof updated.stockQuantity === 'number' ? updated.stockQuantity : 0) > 0;
          if (updated.inStock !== hasStock) {
            await Product.findByIdAndUpdate(productId, { $set: { inStock: hasStock } });
          }
        }
      } catch (stockErr) {
        console.error('Cancel restock error:', stockErr);
      }
    }

    // Best effort email notification
    try {
      await sendOrderStatusEmail(order, 'CANCELLED');
    } catch (mailErr) {
      console.error('Cancel email send error:', mailErr);
    }

    const populatedOrder = await Order.findById(order._id)
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .populate('addressId')
      .lean();

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: populatedOrder || order,
    });
  } catch (error) {
    console.error('Order cancel error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to cancel order' }, { status: 500 });
  }
}
