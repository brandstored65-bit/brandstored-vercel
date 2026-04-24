export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

// GET /api/products/[id]/fbt - Fetch frequently bought together products
export async function GET(request, { params }) {
  try {
    await dbConnect();
    
    // Handle async params in Next.js 15
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const product = await Product.findById(id).select('enableFBT fbtProductIds fbtBundlePrice fbtBundleDiscount');
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // If FBT is not enabled or no products selected, return empty
    if (!product.enableFBT || !product.fbtProductIds || product.fbtProductIds.length === 0) {
      return NextResponse.json({ 
        enableFBT: false, 
        products: [], 
        bundlePrice: 0,
        bundleDiscount: 0 
      });
    }

    // Fetch the FBT products
    const fbtProductsRaw = await Product.find({
      _id: { $in: product.fbtProductIds }
    }).select('name price images slug hasVariants variants');

    const fbtProducts = fbtProductsRaw.map((item) => {
      const basePrice = Number(item?.price || 0);
      const variantStock = Array.isArray(item?.variants)
        ? item.variants.some((variant) => Number(variant?.stock || 0) > 0)
        : false;

      return {
        _id: item._id,
        name: item.name,
        price: basePrice,
        images: item.images,
        slug: item.slug,
        hasVariants: !!item.hasVariants,
        variants: item.variants,
        isAvailable: !!(basePrice > 0 && (item.hasVariants ? variantStock : true)),
      };
    });

    return NextResponse.json({
      enableFBT: product.enableFBT,
      products: fbtProducts,
      bundlePrice: product.fbtBundlePrice,
      bundleDiscount: product.fbtBundleDiscount || 0
    });
  } catch (error) {
    console.error('Error fetching FBT products:', error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to fetch FBT products',
      details: error.message 
    }, { status: 500 });
  }
}

// PATCH /api/products/[id]/fbt - Update FBT configuration
export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    
    // Handle async params in Next.js 15
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }
    
    const body = await request.json();

    const { enableFBT, fbtProductIds, fbtBundlePrice, fbtBundleDiscount } = body;

    const normalizedEnable = !!enableFBT;
    const normalizedIds = Array.isArray(fbtProductIds) ? [...new Set(fbtProductIds.map(String))] : [];
    const normalizedBundlePrice = fbtBundlePrice === null || fbtBundlePrice === '' || typeof fbtBundlePrice === 'undefined'
      ? null
      : Number(fbtBundlePrice);
    const normalizedBundleDiscount = fbtBundleDiscount === null || fbtBundleDiscount === '' || typeof fbtBundleDiscount === 'undefined'
      ? null
      : Number(fbtBundleDiscount);

    // Validate input
    if (normalizedEnable && normalizedIds.length === 0) {
      return NextResponse.json({ 
        error: 'At least one product must be selected when enabling FBT' 
      }, { status: 400 });
    }

    if (normalizedIds.includes(String(id))) {
      return NextResponse.json({
        error: 'fbtProductIds cannot include the main product ID'
      }, { status: 400 });
    }

    if (normalizedIds.length > 6) {
      return NextResponse.json({
        error: 'Maximum 6 related products are allowed for FBT'
      }, { status: 400 });
    }

    if (normalizedBundlePrice !== null && (!Number.isFinite(normalizedBundlePrice) || normalizedBundlePrice < 0)) {
      return NextResponse.json({
        error: 'Bundle price should be a non-negative number'
      }, { status: 400 });
    }

    if (normalizedBundleDiscount !== null && (!Number.isFinite(normalizedBundleDiscount) || normalizedBundleDiscount < 0 || normalizedBundleDiscount > 50)) {
      return NextResponse.json({
        error: 'Bundle discount must be between 0 and 50'
      }, { status: 400 });
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        enableFBT: normalizedEnable,
        fbtProductIds: normalizedIds,
        fbtBundlePrice: normalizedBundlePrice,
        fbtBundleDiscount: normalizedBundleDiscount
      },
      { new: true }
    ).select('enableFBT fbtProductIds fbtBundlePrice fbtBundleDiscount');

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Error updating FBT configuration:', error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to update FBT configuration',
      details: error.message 
    }, { status: 500 });
  }
}
