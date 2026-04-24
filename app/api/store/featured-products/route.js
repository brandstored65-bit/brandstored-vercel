export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import Product from '@/models/Product'
import { auth } from "@/lib/firebase-admin";
import authSeller from '@/middlewares/authSeller'

export async function GET(request) {
    try {
        await connectDB()

        const { searchParams } = new URL(request.url)
        const includeProducts = searchParams.get('includeProducts') === 'true'
        const limit = Number(searchParams.get('limit') || 0)

        const authHeader = request.headers.get('authorization')
        let userId = null
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1]
            try {
                const adminAuth = auth;const decodedToken = await adminAuth.verifyIdToken(idToken)
                userId = decodedToken.uid
            } catch (e) {
                // token invalid
            }
        }

        let store = null
        if (userId) {
            const storeId = await authSeller(userId)
            if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
            store = await Store.findById(storeId).select('featuredProductIds')
        } else {
            // Public fallback: prefer store with featured products updated most recently
            store = await Store.findOne({ featuredProductIds: { $exists: true, $ne: [] } })
                .sort({ updatedAt: -1 })
                .select('featuredProductIds')

            // Final fallback: first/only store
            if (!store) {
                store = await Store.findOne().select('featuredProductIds')
            }
        }

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

        const authHeader = request.headers.get('authorization')
        let userId = null
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1]
            try {
                const adminAuth = auth;const decodedToken = await adminAuth.verifyIdToken(idToken)
                userId = decodedToken.uid
            } catch (e) {
                // token invalid
            }
        }

        const storeId = await authSeller(userId)
        if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

        const { productIds } = await request.json()

        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 })
        }

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
