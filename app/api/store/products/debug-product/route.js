import dbConnect from '@/lib/mongodb'
import Product from '@/models/Product'
import authSeller from '@/middlewares/authSeller'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

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

    const product = await Product.findById(productId).lean()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (product.storeId !== storeId) return NextResponse.json({ error: 'Unauthorized to view this product' }, { status: 403 })

    console.log(`[debug-product] retrieved product:${productId}`, {
      name: product.name,
      codEnabled: product.codEnabled,
      onlinePaymentEnabled: product.onlinePaymentEnabled,
      codEnabled_type: typeof product.codEnabled,
      onlinePaymentEnabled_type: typeof product.onlinePaymentEnabled,
    })

    // Return full document for debugging with type info
    return NextResponse.json({ 
      product,
      debug: {
        name: product.name,
        codEnabled: product.codEnabled,
        codEnabled_typeof: typeof product.codEnabled,
        onlinePaymentEnabled: product.onlinePaymentEnabled,
        onlinePaymentEnabled_typeof: typeof product.onlinePaymentEnabled,
      }
    })
  } catch (error) {
    console.error('Error in debug-product:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
