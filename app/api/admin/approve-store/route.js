export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import User from "@/models/User";
import authAdmin from "@/middlewares/authAdmin";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

// Approve Seller
export async function POST(request){
    try {
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        await dbConnect();
        const {storeId, status} = await request.json();

        if(status === 'approved'){
            await Store.findByIdAndUpdate(storeId, {
                status: "approved",
                isActive: true
            });
        }else if(status === 'rejected'){
            await Store.findByIdAndUpdate(storeId, {
                status: "rejected"
            });
        }

        return NextResponse.json({ message: status + ' successfully' });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// get all pending and rejected stores
export async function GET(request){
    try {
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        await dbConnect();
        const stores = await Store.find({
            status: { $in: ["pending", "rejected"] }
        }).lean();

        // Populate user data for each store
        for (let store of stores) {
            if (store.userId) {
                const user = await User.findById(store.userId).lean();
                store.user = user;
            }
        }

        return NextResponse.json({ stores });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
