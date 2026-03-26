import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';

export async function POST(request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
    }

    await connectDB();

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const originalAmount = Number(order.total || 0);
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    const discountAmount = Number((originalAmount * 0.05).toFixed(2));
    const discountedAmount = Number((originalAmount - discountAmount).toFixed(2));

    if (discountedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid discounted amount' }, { status: 400 });
    }

    const stripe = new Stripe(secret);
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'aed',
          product_data: {
            name: `Prepaid payment for order ${order.shortOrderNumber || order._id.toString().slice(-6)}`,
            description: '5% prepaid checkout discount applied',
          },
          unit_amount: Math.round(discountedAmount * 100),
        },
        quantity: 1,
      }],
      success_url: `${origin}/order-success?orderId=${order._id.toString()}`,
      cancel_url: `${origin}/order-success?orderId=${order._id.toString()}`,
      metadata: {
        appId: 'Qui',
        existingOrderId: order._id.toString(),
        prepaidUpsell: 'true',
        originalAmount: originalAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        discountedAmount: discountedAmount.toFixed(2),
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      discountedAmount,
      discountAmount,
    });
  } catch (error) {
    console.error('Stripe prepaid session error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create Stripe session' }, { status: 500 });
  }
}