export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'

export async function GET(request) {
    try {
        await connectDB()

        const authHeader = request.headers.get('authorization')
        let userId = null
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1]
            try {
                const adminAuth = getAuth()
                const decodedToken = await adminAuth.verifyIdToken(idToken)
                userId = decodedToken.uid
            } catch (e) {
                // token invalid
            }
        }

        const storeId = await authSeller(userId)
        if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

        const store = await Store.findById(storeId).select('designSettings').lean()
        const settings = store?.designSettings || {}

        return NextResponse.json(settings)
    } catch (error) {
        console.error('Error fetching appearance settings:', error)
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
                const adminAuth = getAuth()
                const decodedToken = await adminAuth.verifyIdToken(idToken)
                userId = decodedToken.uid
            } catch (e) {
                // token invalid
            }
        }

        const storeId = await authSeller(userId)
        if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

        const designSettings = await request.json()

        await Store.findByIdAndUpdate(
            storeId,
            { $set: { designSettings } },
            { new: true }
        )

        return NextResponse.json({ message: 'Appearance settings saved successfully', designSettings })
    } catch (error) {
        console.error('Error saving appearance settings:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}
