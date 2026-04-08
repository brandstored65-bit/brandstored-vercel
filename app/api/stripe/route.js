import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import User from "@/models/User";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const applyPrepaidDiscountToOrder = async (orderId, discountAmountRaw) => {
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return;

    const originalTotal = Number(existingOrder.total || 0);
    const requestedDiscount = Number(discountAmountRaw || 0);
    const discountAmount = Number((requestedDiscount > 0 ? requestedDiscount : originalTotal * 0.05).toFixed(2));
    const discountedTotal = Number(Math.max(0, originalTotal - discountAmount).toFixed(2));

    existingOrder.total = discountedTotal;
    existingOrder.isPaid = true;
    existingOrder.paymentMethod = 'STRIPE';
    existingOrder.paymentStatus = 'PAID';
    existingOrder.isCouponUsed = true;
    existingOrder.coupon = {
        code: 'PREPAID5',
        title: '5% prepaid discount',
        description: 'Applied when converting COD to prepaid payment via Stripe',
        discountType: 'fixed',
        discount: discountAmount,
        discountAmount,
        originalDiscountType: 'percentage',
        discountValue: 5,
    };
    await existingOrder.save();
};

export async function POST(request){
    try {
        const secret = process.env.STRIPE_SECRET_KEY
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
        if (!secret || !webhookSecret) {
            return NextResponse.json({ error: 'Stripe is disabled (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)' }, { status: 503 })
        }

        // Initialize Stripe lazily only when configured
        const stripe = new Stripe(secret)
        const body = await request.text()
        const sig = request.headers.get('stripe-signature')

        const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)

        const handlePaymentIntent = async (paymentIntentId, isPaid) => {
            const session = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId
            });

            if (!session.data.length) {
                return;
            }

            const {orderIds, userId, appId, existingOrderId, prepaidUpsell, discountAmount} = session.data[0].metadata;
            
            if(appId !== 'Qui'){
                return NextResponse.json({received: true, message: 'Invalid app id'});
            }

            await dbConnect();

            if (existingOrderId && prepaidUpsell === 'true') {
                if (isPaid) {
                    await applyPrepaidDiscountToOrder(existingOrderId, discountAmount);
                }
                return;
            }

            const orderIdsArray = orderIds.split(',');

            if(isPaid){
                // mark order as paid
                await Promise.all(orderIdsArray.map(async (orderId) => {
                    await Order.findByIdAndUpdate(orderId, {
                        isPaid: true,
                        paymentStatus: 'PAID',
                        paymentMethod: 'STRIPE',
                    });
                }));
                // delete cart from user
                await User.findOneAndUpdate({ firebaseUid: userId }, {
                    cart: {}
                });
            }else{
                 // delete order from db
                 await Promise.all(orderIdsArray.map(async (orderId) => {
                    await Order.findByIdAndDelete(orderId);
                 }));
            }
        };

    
        switch (event.type) {
            case 'payment_intent.succeeded': {
                await handlePaymentIntent(event.data.object.id, true)
                break;
            }

            case 'payment_intent.canceled': {
                await handlePaymentIntent(event.data.object.id, false)
                break;
            }
        
            default:
                console.log('Unhandled event type:', event.type)
                break;
        }

        return NextResponse.json({received: true})
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

export const config = {
    api: { bodyparser: false }
}