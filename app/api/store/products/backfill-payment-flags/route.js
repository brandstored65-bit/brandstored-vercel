export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb'
import Product from '@/models/Product'
import authSeller from '@/middlewares/authSeller'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // Extract and verify Firebase token
    const authHeader = request.headers.get('authorization')
    let userId = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1]
      try {
        const { getAuth } = await import('firebase-admin/auth')
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app')
        if (getApps().length === 0) initializeApp({ credential: applicationDefault() })
        const decoded = await getAuth().verifyIdToken(idToken)
        userId = decoded.uid
      } catch (e) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized as seller' }, { status: 401 })

    await dbConnect()

    // Match products missing either flag
    const filter = {
      storeId,
      $or: [ { codEnabled: { $exists: false } }, { onlinePaymentEnabled: { $exists: false } } ]
    }

    const update = { $set: { codEnabled: true, onlinePaymentEnabled: true } }

    const result = await Product.updateMany(filter, update)

    console.log(`[backfill-payment-flags] store:${storeId} matched:${result.matchedCount} modified:${result.modifiedCount}`)

    return NextResponse.json({ message: 'Backfill complete', matched: result.matchedCount, modified: result.modifiedCount })
  } catch (error) {
    console.error('Error in backfill-payment-flags:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
