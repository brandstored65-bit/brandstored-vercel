import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { verifyAuth } from "@/lib/verifyAuth";

export async function POST(request) {
  const startTime = Date.now();
  
  try {
    await dbConnect();
    
    const body = await request.json();
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, paymentPayload } = body;

    // Validate required fields
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      console.error('[Verify] Missing required fields');
      return NextResponse.json({ 
        success: false, 
        message: "Missing payment verification data" 
      }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('[Verify] RAZORPAY_KEY_SECRET not configured');
      return NextResponse.json({ 
        success: false, 
        message: "Payment system configuration error" 
      }, { status: 500 });
    }

    // Create signature
    const text = razorpay_order_id + "|" + razorpay_payment_id;
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    // Verify signature
    if (generated_signature === razorpay_signature) {
      // If paying for an existing COD order (upsell), update that order instead of creating a new one
      if (paymentPayload && paymentPayload.existingOrderId) {
        try {
          const existingOrder = await Order.findById(paymentPayload.existingOrderId);
          if (!existingOrder) {
            return NextResponse.json({ success: false, message: 'Existing order not found' }, { status: 404 });
          }

          // Apply 5% prepaid discount and mark as paid
          const originalTotal = Number(existingOrder.total || 0);
          const discountAmount = Number((originalTotal * 0.05).toFixed(2));
          const discountedTotal = Number((originalTotal - discountAmount).toFixed(2));
          existingOrder.total = discountedTotal;
          existingOrder.isPaid = true;
          existingOrder.paymentMethod = 'CARD';
          existingOrder.paymentStatus = 'paid';
          existingOrder.isCouponUsed = true;
          existingOrder.coupon = {
            code: 'PREPAID5',
            title: '5% prepaid discount',
            description: 'Applied when converting COD to prepaid payment',
            discountType: 'fixed',
            discount: discountAmount,
            discountAmount,
            originalDiscountType: 'percentage',
            discountValue: 5,
          };
          await existingOrder.save();

          return NextResponse.json({ 
            success: true,
            orderId: existingOrder._id.toString(),
            message: 'Existing order updated to prepaid with discount' 
          });
        } catch (e) {
          return NextResponse.json({ success: false, message: e.message || 'Failed to update existing order' }, { status: 500 });
        }
      }

      // Payment verified - create a fresh order via the main Orders API (standard card checkout)
      console.log('[Verify] Payment verified successfully:', razorpay_payment_id);
      console.log('[Verify] Creating order in database...');
      
      // Prepare the order creation payload
      const orderPayload = {
        items: paymentPayload.items,
        paymentMethod: 'CARD',
        shippingFee: paymentPayload.shippingFee || 0,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
      };

      if (paymentPayload.coinsToRedeem) {
        orderPayload.coinsToRedeem = paymentPayload.coinsToRedeem;
      }

      // Add user/guest info
      if (paymentPayload.token) {
        // Logged-in user
        const auth = await verifyAuth(paymentPayload.token);
        if (auth?.userId && paymentPayload.addressId) {
          orderPayload.addressId = paymentPayload.addressId;
        }
      } else if (paymentPayload.isGuest && paymentPayload.guestInfo) {
        // Guest user
        orderPayload.isGuest = true;
        orderPayload.guestInfo = paymentPayload.guestInfo;
      }

      // Call the main orders API internally
      const orderRequest = new Request(request.url.replace('/razorpay/verify', '/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(paymentPayload.token ? { 'Authorization': `Bearer ${paymentPayload.token}` } : {})
        },
        body: JSON.stringify(orderPayload)
      });

      // Import and call the orders POST handler
      const { POST: createOrder } = await import('@/app/api/orders/route');
      const orderResponse = await createOrder(orderRequest);
      const orderData = await orderResponse.json();

      // Check for id field (from orders API response) or orderId
      const orderId = orderData.id || orderData.orderId || orderData._id;
      
      if (orderResponse.ok && orderId) {
        const duration = Date.now() - startTime;
        console.log(`[Verify] Order created successfully: ${orderId} (${duration}ms)`);
        
        return NextResponse.json({ 
          success: true,
          _id: orderId,
          orderId: orderId,
          message: "Payment verified and order created successfully" 
        });
      } else {
        console.error('[Verify] Order creation failed:', orderData);
        console.error('[Verify] Response status:', orderResponse.status);
        
        return NextResponse.json({ 
          success: false, 
          message: orderData.error || "Order creation failed after payment" 
        }, { status: 400 });
      }
    } else {
      console.error('[Verify] Signature verification failed');
      console.error('[Verify] Expected:', generated_signature);
      console.error('[Verify] Received:', razorpay_signature);
      
      return NextResponse.json({ 
        success: false, 
        message: "Payment verification failed" 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("[Verify] Critical error:", error);
    console.error("[Verify] Stack:", error.stack);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      message: "Payment verification system error"
    }, { status: 500 });
  }
}
