import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const excludeId = searchParams.get('excludeId') || '';
    const limitParam = Number(searchParams.get('limit') || '12');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;

    if (category) {
      await dbConnect();

      const categoryQuery = {
        category: { $regex: category, $options: 'i' },
        inStock: true
      };

      if (excludeId) {
        categoryQuery._id = { $ne: excludeId };
      }

      const products = await Product.find(categoryQuery)
        .select('_id name slug images price mrp AED category tags inStock')
        .limit(limit)
        .lean();

      return NextResponse.json({
        keyword: '',
        products: products.map(p => ({
          _id: p._id,
          slug: p.slug,
          name: p.name,
          image: p.images?.[0] || '',
          price: p.price,
          AED: p.AED,
          category: p.category
        })),
        resultCount: products.length,
        message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`
      });
    }

    if (!keyword) {
      return NextResponse.json({ 
        error: 'No keyword provided',
        products: [],
        resultCount: 0
      }, { status: 400 });
    }

    await dbConnect();
    
    console.log(`Search for keyword: ${keyword}`);
    
    // Strategy 1: Try exact phrase match
    let products = await Product.find({
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
      ],
      inStock: true
    })
    .select('_id name slug images price mrp AED category tags inStock')
    .limit(limit)
    .lean();

    // Strategy 2: Word boundary match
    if (products.length === 0) {
      const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      products = await Product.find({
        $or: [
          { name: wordBoundaryRegex },
          { category: wordBoundaryRegex },
          { tags: wordBoundaryRegex },
        ],
        inStock: true
      })
      .select('_id name slug images price mrp AED category tags inStock')
      .limit(limit)
      .lean();
    }

    // Strategy 3: Partial match
    if (products.length === 0) {
      const partialRegex = new RegExp(keyword, 'i');
      products = await Product.find({
        $or: [
          { name: partialRegex },
          { category: partialRegex },
          { tags: partialRegex },
          { shortDescription: partialRegex },
        ],
        inStock: true
      })
      .select('_id name slug images price mrp AED category tags inStock')
      .limit(limit)
      .lean();
    }

    // Strategy 4: Prefix match
    if (products.length === 0 && keyword.length > 2) {
      const prefixRegex = new RegExp(`^${keyword.substring(0, 3)}`, 'i');
      products = await Product.find({
        $or: [
          { name: prefixRegex },
          { category: prefixRegex },
        ],
        inStock: true
      })
      .select('_id name slug images price mrp AED category tags inStock')
      .limit(limit)
      .lean();
    }

    // Strategy 5: Fallback to popular products
    if (products.length === 0) {
      products = await Product.find({ inStock: true })
        .select('_id name slug images price mrp AED category tags inStock')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }

    console.log(`Found ${products.length} products for keyword: ${keyword}`);
    
    return NextResponse.json({
      keyword,
      products: products.map(p => ({
        _id: p._id,
        slug: p.slug,
        name: p.name,
        image: p.images?.[0] || '',
        price: p.price,
        AED: p.AED,
        category: p.category
      })),
      resultCount: products.length,
      message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Search products error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
