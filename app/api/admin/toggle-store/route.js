export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import authAdmin from "@/middlewares/authAdmin";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

// Toggle Store isActive
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
            console.error('[TOGGLE STORE] Token verification failed:', e.message);
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        await dbConnect();
        const {storeId} = await request.json();

        if (!storeId) {
            return NextResponse.json({ error: "missing storeId" }, { status: 400 });
        }

        // Find the store
        const store = await Store.findById(storeId);

        if(!store){
           return NextResponse.json({ error: "store not found" }, { status: 400 }); 
        }

        await Store.findByIdAndUpdate(storeId, {
            isActive: !store.isActive
        });

        return NextResponse.json({message: "Store updated successfully"});

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}
