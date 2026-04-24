export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import authSeller from "@/middlewares/authSeller";

import { NextResponse } from "next/server";

// Toggle online payment availability for a product
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];

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

    if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
      return NextResponse.json({ error: 'Product ID required or invalid format' }, { status: 400 });
    }

    const product = await Product.findById(productId);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    if (product.storeId !== storeId) return NextResponse.json({ error: 'Unauthorized to modify this product' }, { status: 403 });

    // If client provided explicit value, use it; otherwise toggle relative to missing/default
    const current = (typeof product.onlinePaymentEnabled === 'boolean') ? product.onlinePaymentEnabled : true;
    const newVal = (typeof requestedValue === 'boolean') ? requestedValue : !current;
    
    // MUTUAL EXCLUSION: Prevent both payment methods from being disabled
    const codEnabled = (typeof product.codEnabled === 'boolean') ? product.codEnabled : true;
    if (newVal === false && codEnabled === false) {
      console.log(`[online-toggle] BLOCKED: Cannot disable online payment when COD is already disabled for product ${productId}`);
      return NextResponse.json({ 
        error: 'Cannot disable online payment - COD is already disabled. At least one payment method must remain enabled.' 
      }, { status: 400 });
    }
    
    console.log(`[online-toggle] BEFORE UPDATE: user:${userId} product:${productId} current:${current} requestedValue:${requestedValue} newVal:${newVal}`);
    console.log(`[online-toggle] About to $set onlinePaymentEnabled to: ${newVal} (type: ${typeof newVal})`);
    
    // Persist using atomic update to avoid any model hooks or doc replacement issues
    const updated = await Product.findByIdAndUpdate(
      productId, 
      { $set: { onlinePaymentEnabled: newVal } }, 
      { new: true }
    ).lean();

    console.log(`[online-toggle] AFTER UPDATE: product._id:${updated?._id} onlinePaymentEnabled:${updated?.onlinePaymentEnabled} (type: ${typeof updated?.onlinePaymentEnabled})`);
    console.log(`[online-toggle] full saved product:`, JSON.stringify({ _id: updated?._id, codEnabled: updated?.codEnabled, onlinePaymentEnabled: updated?.onlinePaymentEnabled, inStock: updated?.inStock }));

    return NextResponse.json({ 
      message: newVal ? 'Online payment enabled' : 'Online payment disabled', 
      onlinePaymentEnabled: newVal, 
      previous: current, 
      product: updated 
    });
  } catch (error) {
    console.error('Error toggling online payment:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
