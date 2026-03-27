import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import Wallet from '@/models/Wallet';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

const VALID_STATUSES = [
    'ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED',
    'PAYMENT_FAILED', 'RETURNED', 'RETURN_INITIATED', 'RETURN_APPROVED',
    'RETURN_REQUESTED', 'PICKUP_REQUESTED', 'WAITING_FOR_PICKUP',
    'PICKED_UP', 'WAREHOUSE_RECEIVED', 'OUT_FOR_DELIVERY',
    'pending', 'processing', 'shipped', 'delivered', 'cancelled'
];

const resolveAuthorizedOrder = (order, storeId) => {
    const orderStoreId = order.storeId ? order.storeId.toString() : null;
    const orderItems = order.items || order.orderItems || [];
    const itemStoreIds = orderItems.map((item) => item.storeId?.toString()).filter(Boolean);

    return orderStoreId === storeId.toString() || itemStoreIds.includes(storeId.toString());
};

const authenticateSeller = async (request) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: NextResponse.json({ error: 'Missing authorization header' }, { status: 401 }) };
    }

    const idToken = authHeader.split(' ')[1];
    let decodedToken;

    try {
        decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (err) {
        return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) };
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
        return { error: NextResponse.json({ error: 'Unauthorized - not a seller' }, { status: 403 }) };
    }

    return { storeId };
};

export async function POST(request) {
    try {
        const auth = await authenticateSeller(request);
        if (auth.error) {
            return auth.error;
        }

        const { storeId } = auth;
        const { action, orderIds, status } = await request.json();

        if (!action || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'Missing action or orderIds' }, { status: 400 });
        }

        if (!['update-status', 'delete'].includes(action)) {
            return NextResponse.json({ error: 'Invalid bulk action' }, { status: 400 });
        }

        if (action === 'update-status' && (!status || !VALID_STATUSES.includes(status))) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        await dbConnect();

        const uniqueOrderIds = Array.from(new Set(orderIds));
        const orders = await Order.find({ _id: { $in: uniqueOrderIds } })
            .populate({ path: 'userId', select: 'email name' })
            .exec();

        if (!orders.length) {
            return NextResponse.json({ error: 'No matching orders found' }, { status: 404 });
        }

        const unauthorizedOrders = orders.filter((order) => !resolveAuthorizedOrder(order, storeId));
        if (unauthorizedOrders.length > 0) {
            return NextResponse.json({ error: 'One or more selected orders do not belong to your store' }, { status: 403 });
        }

        if (orders.length !== uniqueOrderIds.length) {
            return NextResponse.json({ error: 'One or more selected orders could not be found' }, { status: 404 });
        }

        if (action === 'delete') {
            await Order.deleteMany({ _id: { $in: uniqueOrderIds } });

            return NextResponse.json({
                success: true,
                message: `${uniqueOrderIds.length} order(s) deleted successfully`,
                affectedCount: uniqueOrderIds.length,
            });
        }

        const normalizedStatus = String(status || '').toUpperCase();

        await Promise.all(
            orders.map(async (order) => {
                order.status = status;

                const paymentMethod = (order.paymentMethod || '').toLowerCase();
                if (normalizedStatus === 'DELIVERED' && paymentMethod === 'cod') {
                    order.isPaid = true;
                }

                if (order.delhivery?.payment?.is_cod_recovered && paymentMethod === 'cod') {
                    order.isPaid = true;
                }

                if (normalizedStatus === 'DELIVERED' && order.userId && !order.rewardsCredited) {
                    const coinsEarned = 10;

                    await Wallet.findOneAndUpdate(
                        { userId: order.userId },
                        {
                            $inc: { coins: coinsEarned },
                            $push: {
                                transactions: {
                                    type: 'EARN',
                                    coins: coinsEarned,
                                    rupees: Number((coinsEarned * 1).toFixed(2)),
                                    orderId: order._id.toString(),
                                }
                            }
                        },
                        { upsert: true, new: true }
                    );

                    order.coinsEarned = coinsEarned;
                    order.rewardsCredited = true;
                }

                await order.save();

                try {
                    const { sendOrderStatusEmail } = await import('@/lib/email');
                    await sendOrderStatusEmail(order, status);
                } catch (emailError) {
                    console.error('[store/orders/bulk] Email sending failed:', emailError);
                }
            })
        );

        return NextResponse.json({
            success: true,
            message: `${orders.length} order(s) updated to ${status}`,
            affectedCount: orders.length,
        });
    } catch (error) {
        console.error('[store/orders/bulk] Error:', error);
        return NextResponse.json({
            error: 'Failed to run bulk order action',
            message: error.message,
        }, { status: 500 });
    }
}