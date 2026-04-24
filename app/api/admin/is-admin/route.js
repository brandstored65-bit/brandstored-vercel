export const dynamic = 'force-dynamic'

import authAdmin from "@/middlewares/authAdmin";
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

// Auth Admin 
export async function GET(request){
    try {
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        console.log('[IS-ADMIN] Auth header present:', !!authHeader);
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[IS-ADMIN] Missing or invalid auth header');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        console.log('[IS-ADMIN] Token length:', idToken?.length);
        console.log('[IS-ADMIN] Token preview:', idToken?.substring(0, 50) + '...');
        
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
            console.log('[IS-ADMIN] Token verified successfully');
            console.log('[IS-ADMIN] Decoded token:', { uid: decodedToken.uid, email: decodedToken.email });
        } catch (e) {
            console.error('[IS-ADMIN] Token verification failed:', e.code, e.message);
            console.error('[IS-ADMIN] Full error:', e);
            return NextResponse.json({ error: 'Invalid token', details: e.message, code: e.code }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        console.log('[IS-ADMIN] Checking admin status for:', email);
        const isAdmin = await authAdmin(userId, email);
        console.log('[IS-ADMIN] Admin check result:', isAdmin);

        if(!isAdmin){
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        return NextResponse.json({isAdmin});
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}
