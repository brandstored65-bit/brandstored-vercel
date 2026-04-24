export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import { getAuth } from '@/lib/firebase-admin';

/**
 * Check Razorpay payment status and auto-update order if settled
 * GET /api/orders/check-razorpay-settlement?orderId=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({
        error: 'Missing orderId parameter'
      }, { status: 400 });
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized: Missing authorization header'
      }, { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    await dbConnect();

    // Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({
        error: 'Order not found'
      }, { status: 404 });
    }

    // Check if order has Razorpay payment method and payment ID
    if (!order.razorpayPaymentId) {
      return NextResponse.json({
        error: 'This order does not have a Razorpay payment ID',
        paymentMethod: order.paymentMethod
      }, { status: 400 });
    }

    // Check Razorpay payment status
    const razorpayStatus = await getCompleteRazorpayStatus(order.razorpayPaymentId);

    if (!razorpayStatus.payment.success) {
      return NextResponse.json({
        error: 'Failed to fetch Razorpay payment status',
        details: razorpayStatus.payment.error
      }, { status: 500 });
    }

    // Update order if payment is captured
    if (razorpayStatus.is_payment_captured && !order.isPaid) {
      console.log(`[Razorpay] Auto-marking order ${orderId} as PAID - payment captured`);
      order.isPaid = true;
      order.paymentStatus = 'CAPTURED';
      
      // Store settlement info
      order.razorpaySettlement = {
        paymentId: order.razorpayPaymentId,
        status: razorpayStatus.settlement_status,
        captured_at: new Date(razorpayStatus.payment.created_at * 1000),
        amount: razorpayStatus.payment.amount,
        fee: razorpayStatus.payment.fee || 0,
        is_transferred: razorpayStatus.is_transferred_to_bank,
        transferred_at: razorpayStatus.settlement?.transferred_at || null
      };
      
      await order.save();
    }

    return NextResponse.json({
      success: true,
      order: {
        _id: order._id,
        isPaid: order.isPaid,
        paymentStatus: order.paymentStatus,
        razorpayPaymentId: order.razorpayPaymentId
      },
      razorpayStatus: {
        payment_captured: razorpayStatus.is_payment_captured,
        transferred_to_bank: razorpayStatus.is_transferred_to_bank,
        settlement_status: razorpayStatus.settlement_status,
        amount: razorpayStatus.payment.amount,
        currency: razorpayStatus.payment.currency,
        fee: razorpayStatus.payment.fee,
        created_at: razorpayStatus.payment.created_at,
        transfer_details: razorpayStatus.settlement.is_transferred ? {
          transfer_id: razorpayStatus.settlement.transfer_id,
          transferred_at: razorpayStatus.settlement.transferred_at,
          amount_transferred: razorpayStatus.settlement.amount_transferred
        } : null
      }
    });

  } catch (error) {
    console.error('[check-razorpay-settlement API]', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}
