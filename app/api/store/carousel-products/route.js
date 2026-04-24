import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import admin from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// GET: Public - fetch carousel product IDs
export async function GET(request) {
    try {
        await connectDB()
        const store = await Store.findOne().select('carouselProductIds')
        return NextResponse.json({
            productIds: store?.carouselProductIds || []
        })
    } catch (error) {
        console.error('Error fetching carousel products:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

// POST: Admin - set carousel product IDs
export async function POST(request) {
    try {
        await connectDB();
        // Debug: log Authorization header
        const authHeader = request.headers.get('authorization');
        console.log('[CarouselProducts API] Authorization header:', authHeader);
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[CarouselProducts API] Missing or malformed Authorization header');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split(' ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (err) {
            console.log('[CarouselProducts API] Token verification error:', err);
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        // Optionally, check for admin/seller role here using decodedToken
        const { productIds } = await request.json();
        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 });
        }
        const store = await Store.findOneAndUpdate(
            {},
            { carouselProductIds: productIds },
            { new: true }
        );
        return NextResponse.json({
            message: 'Carousel products updated successfully',
            productIds: store.carouselProductIds
        });
    } catch (error) {
        console.error('[CarouselProducts API] Error saving carousel products:', error);
        return NextResponse.json({ error: error.message, details: error }, { status: 400 });
    }
}
