import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import Product from '@/models/Product'

export async function GET() {
  try {
    await dbConnect()

    console.log('Fetching social proof products from DB...')

    // Get random products that are in stock
    const products = await Product.aggregate([
      {
        $match: {
          inStock: true,
          images: { $exists: true, $ne: [] }
        }
      },
      { $sample: { size: 20 } }, // Get 20 random products
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          price: 1,
          AED: 1,
          images: 1,
          inStock: 1
        }
      }
    ])

    console.log('Found', products.length, 'products for social proof')

    return NextResponse.json({
      success: true,
      products
    })
  } catch (error) {
    console.error('Error fetching social proof products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
