export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import authSeller from "@/middlewares/authSeller";

import { NextResponse } from "next/server";

// Toggle COD availability for a product
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const { getAuth } = await import('firebase-admin/auth');
      const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
      if (getApps().length === 0) initializeApp({ credential: applicationDefault() });
      try {
        const decoded = await auth.verifyIdToken(idToken);
        userId = decoded.uid;
      } catch (e) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const productId = body?.productId;
    const requestedValue = body?.value;
    if (!productId) return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });

    const storeId = await authSeller(userId);
    if (!storeId) return NextResponse.json({ error: 'Not authorized as seller' }, { status: 401 });

    await dbConnect();

    // Validate productId
    if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
      return NextResponse.json({ error: 'Product ID required or invalid format' }, { status: 400 });
    }

    const product = await Product.findById(productId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (product.storeId !== storeId) return NextResponse.json({ error: 'Unauthorized to modify this product' }, { status: 403 });

    // If client provided explicit value, use it; otherwise toggle relative to missing/default
    const current = (typeof product.codEnabled === 'boolean') ? product.codEnabled : true;
    const newVal = (typeof requestedValue === 'boolean') ? requestedValue : !current;
    
    // MUTUAL EXCLUSION: Prevent both payment methods from being disabled
    const onlinePaymentEnabled = (typeof product.onlinePaymentEnabled === 'boolean') ? product.onlinePaymentEnabled : true;
    if (newVal === false && onlinePaymentEnabled === false) {
      console.log(`[cod-toggle] BLOCKED: Cannot disable COD when online payment is already disabled for product ${productId}`);
      return NextResponse.json({ 
        error: 'Cannot disable COD - online payment is already disabled. At least one payment method must remain enabled.' 
      }, { status: 400 });
    }
    
    console.log(`[cod-toggle] BEFORE UPDATE: user:${userId} product:${productId} current:${current} requestedValue:${requestedValue} newVal:${newVal}`);
    console.log(`[cod-toggle] About to $set codEnabled to: ${newVal} (type: ${typeof newVal})`);
    
    // Persist using atomic update to avoid any model hooks or doc replacement issues
    const updated = await Product.findByIdAndUpdate(
      productId, 
      { $set: { codEnabled: newVal } }, 
      { new: true }
    ).lean();

    console.log(`[cod-toggle] AFTER UPDATE: product._id:${updated?._id} codEnabled:${updated?.codEnabled} (type: ${typeof updated?.codEnabled})`);
    console.log(`[cod-toggle] full saved product:`, JSON.stringify({ _id: updated?._id, codEnabled: updated?.codEnabled, onlinePaymentEnabled: updated?.onlinePaymentEnabled, inStock: updated?.inStock }));

    return NextResponse.json({ 
      message: newVal ? 'COD enabled' : 'COD disabled', 
      codEnabled: newVal, 
      previous: current, 
      product: updated 
    });
  } catch (error) {
    console.error('Error toggling COD:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
