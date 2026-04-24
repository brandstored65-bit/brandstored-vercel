export const dynamic = 'force-dynamic'

import connectDB from '@/lib/mongodb';
import GuestUser from '@/models/GuestUser';
import Order from '@/models/Order';
import { NextResponse } from "next/server";
import admin from 'firebase-admin';

// Link guest orders to newly created user account
export async function POST(request) {
    try {
        await connectDB();

        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                })
            });
        }

        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (err) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        
        if (!userId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 401 });
        }

    
        const user = await request.json();
        const { email, phone } = user;

        if (!email && !phone) {
            return NextResponse.json({ error: "Email or phone required" }, { status: 400 });
        }

        // Find guest user by email or phone
        const guestUserFilter = [];
        if (email) guestUserFilter.push({ email: email });
        if (phone) guestUserFilter.push({ phone: phone });

        const guestUser = await GuestUser.findOne({
            $or: guestUserFilter,
            accountCreated: false
        }).lean();

        if (!guestUser) {
            return NextResponse.json({ 
                message: "No guest orders found",
                linked: false 
            });
        }

        // Find all guest orders with matching email or phone
        const orderFilter = [];
        if (email) orderFilter.push({ guestEmail: email });
        if (phone) orderFilter.push({ guestPhone: phone });

        const guestOrders = await Order.find({
            isGuest: true,
            $or: orderFilter
        }).lean();

        if (guestOrders.length === 0) {
            return NextResponse.json({ 
                message: "No guest orders found",
                linked: false 
            });
        }

        // Link guest orders to the new user account
        await Order.updateMany({
            _id: {
                $in: guestOrders.map(order => order._id)
            }
        }, {
            userId: userId,
            isGuest: false
        });

        // Mark guest user account as converted
        await GuestUser.findByIdAndUpdate(guestUser._id, {
            accountCreated: true
        });

        return NextResponse.json({ 
            message: `Successfully linked ${guestOrders.length} guest order(s) to your account`,
            linked: true,
            count: guestOrders.length
        });

    } catch (error) {
        console.error("Error linking guest orders:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to link guest orders" 
        }, { status: 500 });
    }
}
