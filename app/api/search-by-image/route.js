import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    if (!image) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    // Extract keywords from filename (reliable method)
    const filename = image.name.toLowerCase();
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    const isLikelyHash = /^[a-f0-9]{12,}$/i.test(nameWithoutExt);
    if (isLikelyHash) {
      return NextResponse.json({
        error: 'Image filename is not descriptive. Rename the file (e.g., yoga-mat.jpg) and try again.',
        keyword: '',
        keywords: [],
        resultCount: 0
      }, { status: 400 });
    }

    // Split filename by common delimiters to extract keywords
    const rawKeywords = nameWithoutExt
      .split(/[-_\s\.]+/)
      .filter(word => word.length > 2 && !/^\d+$/.test(word))
      .map(word => word.trim());

    if (rawKeywords.length === 0) {
      return NextResponse.json({ 
        error: 'Please use a descriptive filename like "shoes.jpg", "headphones-wireless.jpg", or "coffee-maker.jpg"',
        keyword: '',
        keywords: [],
        resultCount: 0
      }, { status: 400 });
    }

    // Connect to database
    await dbConnect();
    
    const synonymMap = {
      mat: ['rug', 'carpet', 'doormat', 'yoga'],
      rug: ['mat', 'carpet', 'doormat'],
      shoe: ['shoes', 'sneakers', 'footwear'],
      shoes: ['shoe', 'sneakers', 'footwear'],
      sneaker: ['sneakers', 'shoes', 'footwear'],
      bag: ['handbag', 'purse', 'backpack', 'satchel'],
      watch: ['smartwatch', 'wristwatch'],
      phone: ['mobile', 'smartphone'],
      mobile: ['phone', 'smartphone'],
      headphone: ['headphones', 'earphone', 'earphones'],
      headphones: ['headphone', 'earphone', 'earphones'],
      bottle: ['flask', 'water'],
      mug: ['cup', 'coffee'],
      sofa: ['couch'],
      laptop: ['notebook', 'computer']
    };

    const expandedKeywords = Array.from(new Set(
      rawKeywords.flatMap((word) => [word, ...(synonymMap[word] || [])])
    ));

    console.log(`Image search keywords extracted: ${rawKeywords.join(', ')}`);
    console.log(`Image search expanded keywords: ${expandedKeywords.join(', ')}`);
    
    // Strategy 1: Try exact phrase match (best match)
    const exactPhrase = rawKeywords.join(' ');
    let products = await Product.find({
      $or: [
        { name: { $regex: exactPhrase, $options: 'i' } },
      ],
      inStock: true
    })
    .select('_id name slug images price mrp AED category tags inStock')
    .limit(12)
    .lean();

    // Strategy 2: If no exact match, search by first keyword (main term)
    if (products.length === 0) {
      const mainKeyword = rawKeywords[0];
      const mainKeywordRegex = new RegExp(`\\b${mainKeyword}\\b`, 'i'); // Word boundary match
      products = await Product.find({
        $or: [
          { name: mainKeywordRegex },
          { category: mainKeywordRegex },
          { tags: mainKeywordRegex },
        ],
        inStock: true
      })
      .select('_id name slug images price mrp AED category tags inStock')
      .limit(12)
      .lean();
    }

    // Strategy 3: Partial match with all keywords
    if (products.length === 0) {
      const keywordRegex = new RegExp(expandedKeywords.join('|'), 'i');
      products = await Product.find({
        $or: [
          { name: keywordRegex },
          { category: keywordRegex },
          { tags: keywordRegex },
        ],
        inStock: true
      })
      .select('_id name slug images price mrp AED category tags inStock')
      .limit(12)
      .lean();
    }

    let recommendedProducts = [];
    if (products.length === 0) {
      recommendedProducts = await Product.find({ inStock: true })
        .select('_id name slug images price mrp AED category tags inStock')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
    }

    console.log(`Image search: Found ${products.length} products using strategies`);
    
    return NextResponse.json({
      keyword: rawKeywords[0] || expandedKeywords[0] || '',
      keywords: expandedKeywords,
      products: products.map(p => ({
        _id: p._id,
        slug: p.slug,
        name: p.name,
        image: p.images?.[0] || '',
        price: p.price,
        AED: p.AED,
        category: p.category
      })),
      recommendedProducts: recommendedProducts.map(p => ({
        _id: p._id,
        slug: p.slug,
        name: p.name,
        image: p.images?.[0] || '',
        price: p.price,
        AED: p.AED,
        category: p.category
      })),
      resultCount: products.length,
      searchMethod: 'filename-based',
      searchKeywords: expandedKeywords,
      message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Image search error:', error);
    return NextResponse.json({ error: error.message || 'Image search failed' }, { status: 500 });
  }
}
