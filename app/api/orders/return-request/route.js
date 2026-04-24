export const dynamic = 'force-dynamic'

import { auth } from "@/lib/firebase-admin";
import Order from '@/models/Order';
import connectDB from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    await connectDB();

    const { orderId, itemIndex, reason, type, description, images } = await req.json();

    // Validate order belongs to user
    const order = await Order.findById(orderId);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    
    if (order.userId !== userId && order.guestEmail !== decoded.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if order is delivered
    if (order.status !== 'DELIVERED') {
      return NextResponse.json({ error: 'Order must be delivered to request return/replacement' }, { status: 400 });
    }

    // Add return request
    const returnRequest = {
      itemIndex,
      reason,
      type: type || 'RETURN',
      status: 'REQUESTED',
      description,
      images: images || [],
      requestedAt: new Date(),
    };

    order.returns = order.returns || [];
    order.returns.push(returnRequest);
    await order.save();

    return NextResponse.json({
      success: true,
      message: `${type || 'Return'} request submitted successfully`,
      returns: order.returns
    }, { status: 200 });
  } catch (error) {
    console.error('Return request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    await connectDB();

    // Get all returns for this user
    const orders = await Order.find({
      $or: [{ userId }, { guestEmail: decoded.email }],
      returns: { $exists: true, $ne: [] }
    }).select('_id shortOrderNumber returns status createdAt orderItems');

    return NextResponse.json({
      success: true,
      returns: orders
    }, { status: 200 });
  } catch (error) {
    console.error('Get returns error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
