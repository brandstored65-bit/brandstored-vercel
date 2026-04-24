export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

// GET /api/products/[id]/checkout-offer - Fetch checkout offer config
export async function GET(request, { params }) {
  try {
    await dbConnect();

    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const baseProduct = await Product.collection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        projection: {
          enableCheckoutOffer: 1,
          checkoutOfferProductId: 1,
          checkoutOfferDiscountPercent: 1,
        },
      }
    );

    if (!baseProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const offerProductId = String(baseProduct.checkoutOfferProductId || '').trim();

    if (!baseProduct.enableCheckoutOffer || !offerProductId || !mongoose.Types.ObjectId.isValid(offerProductId)) {
      return NextResponse.json({
        enableCheckoutOffer: false,
        product: null,
        discountPercent: 0,
      });
    }

    const offerProduct = await Product.collection.findOne(
      { _id: new mongoose.Types.ObjectId(offerProductId) },
      {
        projection: {
          _id: 1,
          name: 1,
          price: 1,
          AED: 1,
          images: 1,
          slug: 1,
          hasVariants: 1,
          variants: 1,
          inStock: 1,
          stockQuantity: 1,
          sku: 1,
          tags: 1,
        },
      }
    );

    if (!offerProduct) {
      return NextResponse.json({
        enableCheckoutOffer: false,
        product: null,
        discountPercent: 0,
      });
    }

    return NextResponse.json({
      enableCheckoutOffer: !!baseProduct.enableCheckoutOffer,
      product: offerProduct,
      discountPercent: Number(baseProduct.checkoutOfferDiscountPercent || 0),
    });
  } catch (error) {
    console.error('Error fetching checkout offer:', error.message, error.stack);
    return NextResponse.json(
      {
        error: 'Failed to fetch checkout offer',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// PATCH /api/products/[id]/checkout-offer - Update checkout offer config
export async function PATCH(request, { params }) {
  try {
    await dbConnect();

    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { enableCheckoutOffer, checkoutOfferProductId, checkoutOfferDiscountPercent } = body || {};

    const normalizedEnable = !!enableCheckoutOffer;
    const normalizedProductId = String(checkoutOfferProductId || '').trim();
    const normalizedDiscount =
      checkoutOfferDiscountPercent === null ||
      checkoutOfferDiscountPercent === '' ||
      typeof checkoutOfferDiscountPercent === 'undefined'
        ? null
        : Number(checkoutOfferDiscountPercent);

    if (normalizedEnable && !normalizedProductId) {
      return NextResponse.json(
        { error: 'Please select a product for checkout offer' },
        { status: 400 }
      );
    }

    if (normalizedProductId && normalizedProductId === String(id)) {
      return NextResponse.json(
        { error: 'Offer product cannot be the same as base product' },
        { status: 400 }
      );
    }

    if (normalizedEnable && !mongoose.Types.ObjectId.isValid(normalizedProductId)) {
      return NextResponse.json(
        { error: 'Invalid selected offer product ID' },
        { status: 400 }
      );
    }

    if (
      normalizedDiscount !== null &&
      (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0 || normalizedDiscount > 90)
    ) {
      return NextResponse.json(
        { error: 'Discount must be between 0 and 90' },
        { status: 400 }
      );
    }

    const updateResult = await Product.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          enableCheckoutOffer: normalizedEnable,
          checkoutOfferProductId: normalizedEnable ? normalizedProductId : '',
          checkoutOfferDiscountPercent: normalizedEnable ? normalizedDiscount : null,
        },
      }
    );

    if (!updateResult.matchedCount) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updated = await Product.collection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        projection: {
          _id: 1,
          enableCheckoutOffer: 1,
          checkoutOfferProductId: 1,
          checkoutOfferDiscountPercent: 1,
        },
      }
    );

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error updating checkout offer:', error.message, error.stack);
    return NextResponse.json(
      {
        error: 'Failed to update checkout offer',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
