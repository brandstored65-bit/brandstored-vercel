export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import User from "@/models/User";
import authAdmin from "@/middlewares/authAdmin";
import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";

// Get all approved stores
export async function GET(request){
    console.log('[ADMIN STORES API] Request received');
    try {
        // Use shared Firebase Admin instance from lib to avoid re-init issues
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        console.log('[ADMIN STORES API] Auth header present:', !!authHeader);
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[ADMIN STORES API] No valid auth header');
            return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
        }
        const idToken = authHeader.split(' ')[1];
        console.log('[ADMIN STORES API] Token length:', idToken?.length);
        console.log('[ADMIN STORES API] Token preview:', idToken?.substring(0, 50) + '...');
        
        let decodedToken;
        try {
            console.log('[ADMIN STORES API] Attempting to verify token...');
            decodedToken = await auth.verifyIdToken(idToken);
            console.log('[ADMIN STORES API] Token verified successfully');
        } catch (e) {
            console.error('[ADMIN STORES API] Token verification failed:', e.message);
            console.error('[ADMIN STORES API] Error code:', e.code);
            return NextResponse.json({ error: 'Invalid token', details: e.message, code: e.code }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        console.log('[ADMIN STORES] User attempting access:', { userId, email });
        const isAdmin = await authAdmin(userId, email);
        console.log('[ADMIN STORES] isAdmin check result:', isAdmin);
        if (!isAdmin) {
            return NextResponse.json({ error: 'not authorized', email }, { status: 401 });
        }

        await dbConnect();
        const stores = await Store.find({ status: 'approved' }).lean();

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
