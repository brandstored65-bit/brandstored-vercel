export const dynamic = 'force-dynamic'

import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Wallet from '@/models/Wallet';

// Get all customers for a store with their order statistics

export async function GET(request) {
    try {
        await connectDB();
        
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
        }
        const idToken = authHeader.split(' ')[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const storeId = await authSeller(userId);

        console.log('[customers API] Authenticated user:', userId);
        console.log('[customers API] Store ID:', storeId);

        // Get all registered users (who created accounts)
        const registeredUsers = await User.find({ 
            email: { $exists: true, $ne: null, $ne: '' }
        })
        .select('_id name email image createdAt')
        .lean();

        console.log('[customers API] Registered users found:', registeredUsers.length);

        // Get all orders for this store
        const orders = await Order.find({ storeId })
            .populate({
                path: 'userId',
                select: '_id name email image'
            })
            .populate({
                path: 'orderItems.productId',
                model: 'Product'
            })
            .sort({ createdAt: -1 })
            .lean();

        console.log('[customers API] Total orders found:', orders.length);

        // Group orders by customer and calculate statistics
        const customerMap = new Map();

        orders.forEach(order => {
            // If guest order, use guest info
            let customerId, name, email, image, isGuest = false;
            if (order.isGuest) {
                customerId = `guest-${order.guestEmail || order._id}`;
                name = order.guestName || order.shippingAddress?.name || 'Guest Customer';
                email = order.guestEmail || order.shippingAddress?.email || 'No email';
                image = null;
                isGuest = true;
            } else if (order.userId && typeof order.userId === 'object' && order.userId._id) {
                // User is populated and valid
                customerId = order.userId._id.toString();
                name = order.userId.name || order.shippingAddress?.name || 'Customer';
                email = order.userId.email || order.shippingAddress?.email || 'No email';
                image = order.userId.image || null;
            } else if (order.userId) {
                // User ID exists but not populated - try to get info from order fields
                customerId = order.userId.toString();
                name = order.guestName || order.shippingAddress?.name || 'Customer';
                email = order.guestEmail || order.shippingAddress?.email || 'No email';
                image = null;
            } else {
                // No user ID at all
                customerId = `unknown-${order._id}`;
                name = order.guestName || order.shippingAddress?.name || 'Guest Customer';
                email = order.guestEmail || order.shippingAddress?.email || 'No email';
                image = null;
                isGuest = true;
            }

            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    _id: customerId, // Add _id field for use in send-notification
                    id: customerId,
                    name,
                    email,
                    image,
                    isGuest,
                    totalOrders: 0,
                    totalSpent: 0,
                    firstOrderDate: order.createdAt,
                    lastOrderDate: order.createdAt,
                    orders: []
                });
            }

            const customer = customerMap.get(customerId);
            customer.totalOrders += 1;
            customer.totalSpent += order.total;

            // Convert orderItems to items array
            const items = order.orderItems.map(item => ({
                name: item.productId?.name || 'Product',
                price: item.price,
                quantity: item.quantity
            }));

            customer.orders.push({
                id: order._id.toString(),
                total: order.total,
                status: order.status,
                createdAt: order.createdAt,
                items: JSON.stringify(items)
            });

            // Update first and last order dates
            if (new Date(order.createdAt) < new Date(customer.firstOrderDate)) {
                customer.firstOrderDate = order.createdAt;
            }
            if (new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
                customer.lastOrderDate = order.createdAt;
            }
        });

        // Convert map to array and sort by total spent (descending)
        const customers = Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

        // Add registered users who haven't placed orders yet
        const customerIds = new Set(customers.map(c => c.id.toString()));
        registeredUsers.forEach(user => {
            const userId = user._id.toString();
            if (!customerIds.has(userId)) {
                // Add user who hasn't ordered yet
                customers.push({
                    _id: userId,
                    id: userId,
                    name: user.name || 'User',
                    email: user.email,
                    image: user.image,
                    isGuest: false,
                    totalOrders: 0,
                    totalSpent: 0,
                    firstOrderDate: user.createdAt,
                    lastOrderDate: user.createdAt,
                    orders: []
                });
            }
        });

        // Attach wallet balance for registered users
        const userIds = customers
            .filter(c => !c.isGuest && c.id && !String(c.id).startsWith('guest-') && !String(c.id).startsWith('unknown-'))
            .map(c => c.id.toString());

        const wallets = userIds.length > 0
            ? await Wallet.find({ userId: { $in: userIds } }).lean()
            : [];
        const walletMap = new Map(wallets.map(w => [w.userId, Number(w.coins || 0)]));

        customers.forEach(c => {
            c.walletBalance = c.isGuest ? 0 : (walletMap.get(c.id.toString()) || 0);
        });

        console.log('[customers API] Customers found:', customers.length);

        return NextResponse.json({ customers });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
