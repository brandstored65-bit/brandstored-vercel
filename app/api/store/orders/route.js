export const dynamic = 'force-dynamic'

import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import Address from '@/models/Address';
import { auth } from "@/lib/firebase-admin";
import { fetchNormalizedTracking } from '@/lib/trackingServer';
import { isDelhiveryTracking, isTawseelTracking, mapTrackingStatusToOrderStatus } from '@/lib/trackingShared';

// Debug log helper
function debugLog(...args) {
    try { console.log('[ORDER API DEBUG]', ...args); } catch {}
}



// Update seller order status
export async function POST(request) {
    try {
        await connectDB();
        
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const storeId = await authSeller(userId)
        if(!storeId){
            return NextResponse.json({ error: 'not authorized' }, { status: 401 })
        }

        const {orderId, status } = await request.json()

        await Order.findOneAndUpdate(
            { _id: orderId, storeId },
            { status }
        );

        return NextResponse.json({message: "Order Status updated"})
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}

// Get all orders for a seller
export async function GET(request){
    console.log('[ORDER API ROUTE] Route hit');
    try {
        await connectDB();
        const firebaseAuth = auth;

        const { searchParams } = new URL(request.url);
        const includeDelhivery = searchParams.get('withDelhivery') !== 'false';
        
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await firebaseAuth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        debugLog('userId from Firebase:', userId);
        const storeId = await authSeller(userId)
        debugLog('storeId from authSeller:', storeId);
        if(!storeId){
            debugLog('Not authorized: no storeId');
            return NextResponse.json({ error: 'not authorized' }, { status: 401 })
        }

        const orders = await Order.find({ storeId })
            .populate('addressId')
            .populate({
                path: 'orderItems.productId',
                model: 'Product'
            })
            .sort({ createdAt: -1 })
            .lean();
        
        debugLog('orders found:', orders.length);
        
        // Build a stable customerName on every order from the most reliable source:
        // shippingAddress is always stored at checkout time for both guest and logged-in users.
        // Firebase / DB lookups are skipped here intentionally - they are slow and unreliable
        // (users may have empty name/email in DB if they registered without filling a display name).
        for (let order of orders) {
            const sa = order.shippingAddress;
            if (order.isGuest) {
                order.customerName  = order.guestName  || sa?.name  || 'Guest';
                order.customerEmail = order.guestEmail || sa?.email || '';
            } else {
                // For logged-in users the name from the shipping form is the most reliable source.
                // Fall back to the raw userId string only as last resort.
                order.customerName  = sa?.name  || sa?.email  || '';
                order.customerEmail = sa?.email || '';
                // Keep userId as an object so existing frontend selectors still work
                if (typeof order.userId === 'string') {
                    order.userId = { _id: order.userId, name: order.customerName, email: order.customerEmail };
                }
            }
        }
        
        if (orders.length > 0) {
            debugLog('First order after population:', {
                _id: orders[0]._id,
                userId: orders[0].userId,
                userIdType: typeof orders[0].userId,
                shippingAddress: orders[0].shippingAddress,
                isGuest: orders[0].isGuest
            });
        }

        let enrichedOrders = orders;
        if (includeDelhivery) {
            const shouldFetchDelhivery = (order) => {
                const trackingId = order.trackingId || order.awb || order.airwayBillNo;
                // Only stop fetching once an order is fully delivered or returned.
                const isTerminal = ['DELIVERED', 'RETURNED'].includes(order.status);
                return Boolean(trackingId)
                    && !isTerminal
                    && (
                        isDelhiveryTracking(order.courier, order.trackingUrl)
                        || isTawseelTracking(order.courier, order.trackingUrl)
                    );
            };

            enrichedOrders = await Promise.all(orders.map(async (order) => {
                if (!shouldFetchDelhivery(order)) return order;
                const trackingId = order.trackingId || order.awb || order.airwayBillNo;
                try {
                    const normalized = await fetchNormalizedTracking({
                        trackingId,
                        courier: order.courier,
                        trackingUrl: order.trackingUrl,
                    });
                    if (normalized) {
                        const mappedStatus = mapTrackingStatusToOrderStatus(normalized.delhivery, order.status);
                        return {
                            ...order,
                            courier: normalized.courier || order.courier,
                            trackingId: normalized.trackingId || order.trackingId,
                            trackingUrl: normalized.trackingUrl || order.trackingUrl,
                            delhivery: normalized.delhivery,
                            status: mappedStatus || order.status,
                        };
                    }
                } catch (dlErr) {
                    debugLog('Courier enrichment failed for order', order._id, dlErr?.message || dlErr);
                }
                return order;
            }));
        }

        return NextResponse.json({orders: enrichedOrders})
    } catch (error) {
        console.error('[ORDER API ERROR]', error);
        debugLog('API error:', error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}
