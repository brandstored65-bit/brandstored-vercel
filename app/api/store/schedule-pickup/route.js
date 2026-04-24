export const dynamic = 'force-dynamic'

import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import Order from '@/models/Order';
import { schedulePickup } from '@/lib/delhivery';

export async function POST(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const idToken = authHeader.split('Bearer ')[1];

        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const userId = decodedToken.uid;
        const sellerId = await authSeller(userId);
        if (!sellerId) {
            return new Response(JSON.stringify({ error: 'not authorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { orderId, trackingId, courier, shippingAddress, shipmentWeight, packageCount } = await request.json();

        // Validate required fields
        if (!orderId || !trackingId || courier?.toLowerCase() !== 'delhivery') {
            return new Response(JSON.stringify({
                error: 'Missing required fields or invalid courier'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verify order belongs to seller
        const order = await Order.findOne({ _id: orderId, storeId: sellerId }).lean();

        if (!order) {
            return new Response(JSON.stringify({ error: 'Order not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Prepare pickup data for Delhivery API
        const pickupData = {
            pickupLocationId: process.env.DELHIVERY_PICKUP_LOCATION_ID || '1',
            expectedPackageCount: packageCount || 1,
            pickupDate: new Date().toISOString().split('T')[0], // Today's date
            pickupTimeSlot: '12:00-18:00', // Default time slot
            address: shippingAddress?.street || order.shippingAddress?.street || '',
            city: shippingAddress?.city || order.shippingAddress?.city || '',
            pincode: shippingAddress?.pincode || order.shippingAddress?.pincode || '',
            phone: shippingAddress?.phone || order.shippingAddress?.phone || '',
            name: shippingAddress?.name || order.shippingAddress?.name || '',
            waybill: trackingId,
            weight: shipmentWeight || 0
        };

        // Call Delhivery API to schedule pickup
        const pickupResult = await schedulePickup(pickupData);

        if (!pickupResult.success) {
            return new Response(JSON.stringify({
                error: pickupResult.message || 'Failed to schedule pickup',
                details: pickupResult.details
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Update order with pickup scheduled info
        await Order.updateOne(
            { _id: orderId, storeId: sellerId },
            {
                $set: {
                    'delhivery.pickupScheduled': true,
                    'delhivery.pickupId': pickupResult.pickupId,
                    'delhivery.pickupScheduledAt': new Date(),
                    'delhivery.pickupMessage': pickupResult.message
                }
            }
        );

        return new Response(JSON.stringify({
            success: true,
            message: pickupResult.message || 'Pickup scheduled successfully',
            pickupId: pickupResult.pickupId,
            pickupData
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Schedule pickup error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
