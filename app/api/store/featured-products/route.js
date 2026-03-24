import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import Product from '@/models/Product'

export async function GET(request) {
    try {
        await connectDB()

        const { searchParams } = new URL(request.url)
        const includeProducts = searchParams.get('includeProducts') === 'true'
        const limit = Number(searchParams.get('limit') || 0)

        // Public: get the first (or only) store's featured products
        // Optionally, you can filter by domain, subdomain, or query param for multi-store setups
        const store = await Store.findOne().select('featuredProductIds')
        const productIds = store?.featuredProductIds || []

        if (!includeProducts) {
            return NextResponse.json({
                productIds
            })
        }

        const productsRaw = await Product.find({ _id: { $in: productIds } })
            .select('_id name slug price mrp AED images category inStock stockQuantity')
            .lean()
        const productMap = new Map(productsRaw.map((product) => [product._id.toString(), product]))
        let products = productIds.map((id) => productMap.get(id)).filter(Boolean)

        if (limit > 0) {
            products = products.slice(0, limit)
        }

        return NextResponse.json({
            productIds,
            products
        })
    } catch (error) {
        console.error('Error fetching featured products:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}

export async function POST(request) {
    try {
        await connectDB()

        // Firebase Auth
        const authHeader = request.headers.get('authorization')
        let userId = null
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1]
            const { getAuth } = await import('firebase-admin/auth')
            const { initializeApp, getApps } = await import('firebase-admin/app')
            if (getApps().length === 0) {
                initializeApp({ credential: await import('firebase-admin/app').then(m => m.applicationDefault()) })
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken)
                userId = decodedToken.uid
            } catch (e) {
                // Not authenticated
            }
        }


        // Only allow saving if userId is present (basic check)
        if (!userId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

        // You may want to add more robust seller validation here if needed
        let storeDoc = await Store.findOne({ userId }).select('_id')
        if (!storeDoc) {
            // Fallback for single-store setups
            const fallbackStore = await Store.findOne().select('_id')
            if (!fallbackStore) {
                return NextResponse.json({ error: 'Store not found for user' }, { status: 404 })
            }
            storeDoc = fallbackStore
        }
        const storeId = storeDoc._id

        const { productIds } = await request.json()

        // Validate productIds is an array
        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 })
        }

        // Update store with featured product IDs
        const updatedStore = await Store.findByIdAndUpdate(
            storeId,
            { featuredProductIds: productIds },
            { new: true }
        )

        return NextResponse.json({ 
            message: 'Featured products updated successfully',
            productIds: updatedStore.featuredProductIds 
        })
    } catch (error) {
        console.error('Error saving featured products:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}
