export const dynamic = 'force-dynamic'

import authSeller from "@/middlewares/authSeller";
import connectDB from '@/lib/mongodb';
import Rating from '@/models/Rating';
import Product from '@/models/Product';


// POST: Approve or reject a review
export async function POST(request) {
    try {
        await connectDB();
        
        // Firebase Auth
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await auth.verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                userId = null;
            }
        }

        const storeId = await authSeller(userId);
        if (!storeId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { reviewId, approved } = await request.json();

        if (!reviewId || typeof approved !== 'boolean') {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        const review = await Rating.findById(reviewId).lean()
            .populate({
                path: 'productId',
                select: 'storeId'
            })
            .lean();

        if (!review) {
            return Response.json({ error: "Review not found" }, { status: 404 });
        }

        if (review.productId.storeId !== storeId) {
            return Response.json({ error: "Unauthorized to modify this review" }, { status: 403 });
        }

        const updatedReview = await Rating.findByIdAndUpdate(
            reviewId,
            { approved },
            { new: true }
        );

        return Response.json({
            success: true,
            message: approved ? "Review approved successfully" : "Review rejected successfully",
            review: updatedReview
        });

    } catch (error) {
        console.error('Review approval error:', error);
        return Response.json({
            error: error.message || "Failed to update review"
        }, { status: 500 });
    }
}
