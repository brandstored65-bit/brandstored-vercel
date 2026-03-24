import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import WishlistItem from "@/models/WishlistItem";
import Product from "@/models/Product";

// GET - Fetch user's wishlist
export async function GET(request) {
    try {
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
        }
        
        // Import admin SDK dynamically to avoid SSR issues
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        
        try {
            if (getApps().length === 0) {
                const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
                if (!serviceAccountKey) {
                    return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
                }
                const serviceAccount = JSON.parse(serviceAccountKey);
                initializeApp({ credential: cert(serviceAccount) });
            }
        } catch (initError) {
            console.error('Firebase initialization error:', initError);
            return NextResponse.json({ error: 'Firebase initialization failed' }, { status: 500 });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Connect to database
        try {
            await dbConnect();
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            return NextResponse.json({ 
                error: 'Database connection failed',
                details: dbError?.message 
            }, { status: 500 });
        }
        
        const wishlistItems = await WishlistItem.find({ userId }).sort({ createdAt: -1 }).lean();

        // Populate product data in a single query (avoids N+1 DB calls)
        const validProductIds = [...new Set(
            wishlistItems
                .map(item => item?.productId)
                .filter(pid => typeof pid === 'string' && /^[a-fA-F0-9]{24}$/.test(pid))
        )];

        const products = validProductIds.length
            ? await Product.find({ _id: { $in: validProductIds } })
                .select('_id name slug price mrp AED images inStock stockQuantity')
                .lean()
            : [];

        const productMap = new Map(products.map(p => [String(p._id), p]));

        for (const item of wishlistItems) {
            item.product = productMap.get(String(item.productId)) || null;
        }

        return NextResponse.json({ wishlist: wishlistItems });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        const errorMessage = error?.message || 'Failed to fetch wishlist';
        const statusCode = error?.statusCode || 500;
        return NextResponse.json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        }, { status: statusCode });
    }
}

// POST - Add/Remove product from wishlist
export async function POST(request) {
    try {
        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        if (!idToken) {
            return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
        }
        
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        
        try {
            if (getApps().length === 0) {
                const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
                if (!serviceAccountKey) {
                    return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
                }
                const serviceAccount = JSON.parse(serviceAccountKey);
                initializeApp({ credential: cert(serviceAccount) });
            }
        } catch (initError) {
            console.error('Firebase initialization error:', initError);
            return NextResponse.json({ error: 'Firebase initialization failed' }, { status: 500 });
        }
        
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }
        const userId = decodedToken.uid;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId, action } = await request.json();

        if (!productId || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Connect to database
        try {
            await dbConnect();
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            return NextResponse.json({ 
                error: 'Database connection failed',
                details: dbError?.message 
            }, { status: 500 });
        }

        if (action === 'add') {
            // Check if already in wishlist
            const existing = await WishlistItem.findOne({ userId, productId }).lean();

            if (existing) {
                return NextResponse.json({ message: 'Already in wishlist', inWishlist: true });
            }

            // Add to wishlist
            await WishlistItem.create({
                userId,
                productId
            });

            return NextResponse.json({ message: 'Added to wishlist', inWishlist: true });
        } else if (action === 'remove') {
            // Remove from wishlist
            await WishlistItem.findOneAndDelete({ userId, productId });

            return NextResponse.json({ message: 'Removed from wishlist', inWishlist: false });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Error updating wishlist:', error);
        const errorMessage = error?.message || 'Failed to update wishlist';
        const statusCode = error?.statusCode || 500;
        return NextResponse.json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        }, { status: statusCode });
    }
}
