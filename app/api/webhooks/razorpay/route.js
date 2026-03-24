import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { validateRazorpayWebhookSignature } from '@/lib/razorpay';
import crypto from 'crypto';

/**
 * Razorpay Webhook Handler for real-time payment and settlement updates
 * POST /api/webhooks/razorpay
 * 
 * Handles events:
 * - payment.authorized
 * - payment.captured
 * - payment.failed
 * - settlement.processed
 * - transfer.created
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.warn('[Razorpay Webhook] Invalid signature');
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('[Razorpay Webhook] Event:', event.event);

    await dbConnect();

    switch (event.event) {
      case 'payment.captured':
        return handlePaymentCaptured(event.payload);

      case 'payment.authorized':
        return handlePaymentAuthorized(event.payload);

      case 'payment.failed':
        return handlePaymentFailed(event.payload);

      case 'settlement.processed':
        return handleSettlementProcessed(event.payload);

      case 'transfer.created':
        return handleTransferCreated(event.payload);

      default:
        console.log('[Razorpay Webhook] Unhandled event:', event.event);
        return NextResponse.json({
          success: true,
          message: 'Event received'
        });
    }
  } catch (error) {
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}

async function handlePaymentCaptured(payload) {
  try {
    const paymentId = payload.payment.id;
    const amount = payload.payment.amount;

    // Find order with this payment ID
    const order = await Order.findOne({ razorpayPaymentId: paymentId });

    if (order) {
      console.log(`[Webhook] Payment captured for order ${order._id}`);
      
      // Update order as paid
      order.isPaid = true;
      order.paymentStatus = 'CAPTURED';
      
      // Store settlement info
      order.razorpaySettlement = {
        paymentId,
        status: 'PENDING',
        captured_at: new Date(),
        amount: amount / 100, // Convert paise to rupees
        fee: payload.payment.fee ? payload.payment.fee / 100 : 0
      };
      
      await order.save();
      console.log(`[Webhook] Order ${order._id} marked as PAID`);
    }

    return NextResponse.json({
      success: true,
      message: 'Payment captured processed'
    });
  } catch (error) {
    console.error('[handlePaymentCaptured Error]', error);
    throw error;
  }
}

async function handlePaymentAuthorized(payload) {
  try {
    const paymentId = payload.payment.id;

    // Find order with this payment ID
    const order = await Order.findOne({ razorpayPaymentId: paymentId });

    if (order) {
      console.log(`[Webhook] Payment authorized for order ${order._id}`);
      order.paymentStatus = 'AUTHORIZED';
      await order.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Payment authorized processed'
    });
  } catch (error) {
    console.error('[handlePaymentAuthorized Error]', error);
    throw error;
  }
}

async function handlePaymentFailed(payload) {
  try {
    const paymentId = payload.payment.id;
    const errorReason = payload.payment.error_reason;

    // Find order with this payment ID
    const order = await Order.findOne({ razorpayPaymentId: paymentId });

    if (order) {
      console.log(`[Webhook] Payment failed for order ${order._id}: ${errorReason}`);
      
      order.isPaid = false;
      order.paymentStatus = 'FAILED';
      order.notes = `Payment failed: ${errorReason}`;
      
      await order.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Payment failed processed'
    });
  } catch (error) {
    console.error('[handlePaymentFailed Error]', error);
    throw error;
  }
}

async function handleSettlementProcessed(payload) {
  try {
    const settlementId = payload.settlement.id;
    const amount = payload.settlement.amount;
    const fees = payload.settlement.fees;

    console.log(`[Webhook] Settlement processed: ${settlementId}, Amount: AED${amount / 100}`);

    // Find orders that were part of this settlement
    // You might need to track which orders are in which settlement
    // For now, we'll log it
    return NextResponse.json({
      success: true,
      message: 'Settlement processed'
    });
  } catch (error) {
    console.error('[handleSettlementProcessed Error]', error);
    throw error;
  }
}

async function handleTransferCreated(payload) {
  try {
    const transferId = payload.transfer.id;
    const amount = payload.transfer.amount;
    const source = payload.transfer.source;

    console.log(`[Webhook] Transfer created: ${transferId} for amount AED${amount / 100}`);

    // If this is a payment transfer
    if (source && source.includes('pay_')) {
      const paymentId = source;
      const order = await Order.findOne({ razorpayPaymentId: paymentId });

      if (order && order.razorpaySettlement) {
        console.log(`[Webhook] Updating settlement for order ${order._id}`);
        
        order.razorpaySettlement.is_transferred = true;
        order.razorpaySettlement.transferred_at = new Date();
        order.razorpaySettlement.transfer_id = transferId;
        order.razorpaySettlement.amount_transferred = amount / 100;
        order.razorpaySettlement.status = 'TRANSFERRED';
        
        await order.save();
        console.log(`[Webhook] Order ${order._id} settlement updated - transferred to bank`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transfer created processed'
    });
  } catch (error) {
    console.error('[handleTransferCreated Error]', error);
    throw error;
  }
}
