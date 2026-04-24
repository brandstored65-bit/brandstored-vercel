export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb'
import Product from '@/models/Product'
import { NextResponse } from 'next/server'

// Dev-only endpoint to force-set product payment flags for debugging
export async function POST(request) {
  try {
    // Only allow in non-production or when a dev secret matches
    const host = request.headers.get('host') || ''
    const devSecret = process.env.DEV_DEBUG_SECRET || ''
    const provided = request.headers.get('x-dev-secret') || ''
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }
    // If DEV_DEBUG_SECRET is set, require it; otherwise allow localhost hosts
    if (devSecret) {
      if (!provided || provided !== devSecret) {
        return NextResponse.json({ error: 'Invalid dev secret' }, { status: 401 })
      }
    } else {
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        return NextResponse.json({ error: 'Dev endpoint allowed only on localhost' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { productId, codEnabled, onlinePaymentEnabled } = body || {}
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

    await dbConnect()
    const update = {}
    if (typeof codEnabled === 'boolean') update.codEnabled = codEnabled
    if (typeof onlinePaymentEnabled === 'boolean') update.onlinePaymentEnabled = onlinePaymentEnabled
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No flags provided' }, { status: 400 })

    const updated = await Product.findByIdAndUpdate(productId, { $set: update }, { new: true }).lean()
    if (!updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    console.log('[dev-force-toggle] updated', { productId, update, _id: updated._id })
    return NextResponse.json({ message: 'Updated', product: updated })
  } catch (error) {
    console.error('dev-force-toggle error', error)
    return NextResponse.json({ error: error.message || 'Internal' }, { status: 500 })
  }
}
