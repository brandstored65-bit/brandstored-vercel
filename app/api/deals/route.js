export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Deal from '@/models/Deal';
import Product from '@/models/Product';

// GET: Public API to fetch active deals
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const includeProducts = searchParams.get('includeProducts') === 'true';
    const limit = Number(searchParams.get('limit') || 10);

    const now = new Date();
    
    // Find active deals within current time range
    const query = {
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now }
    };

    if (storeId) {
      query.storeId = storeId;
    }

    let deals = await Deal.find(query)
      .sort({ priority: -1, startTime: 1 })
      .limit(limit)
      .lean();

    if (!includeProducts || deals.length === 0) {
      return NextResponse.json({ 
        deals,
        count: deals.length 
      });
    }

    // Fetch product details for each deal
    const dealsWithProducts = await Promise.all(
      deals.map(async (deal) => {
        if (!deal.productIds || deal.productIds.length === 0) {
          return { ...deal, products: [] };
        }

        const products = await Product.find({ 
          _id: { $in: deal.productIds },
          inStock: true 
        })
          .select('name slug price mrp AED images category inStock fastDelivery imageAspectRatio shortDescription')
          .lean();

        // Preserve order of productIds
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        const orderedProducts = deal.productIds
          .map(id => productMap.get(id))
          .filter(Boolean);

        return { 
          ...deal, 
          products: orderedProducts,
          timeRemaining: deal.endTime.getTime() - now.getTime()
        };
      })
    );

    return NextResponse.json({ 
      deals: dealsWithProducts,
      count: dealsWithProducts.length
    });
  } catch (error) {
    console.error('GET /api/deals error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
