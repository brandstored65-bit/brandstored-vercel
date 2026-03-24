import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Deal from '@/models/Deal';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

const getUserIdFromRequest = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const adminAuth = getAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    return null;
  }
};

// GET: Fetch all deals for the authenticated seller
export async function GET(request) {
  try {
    await connectDB();

    const userId = await getUserIdFromRequest(request);
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeProducts = searchParams.get('includeProducts') === 'true';

    const deals = await Deal.find({ storeId })
      .sort({ priority: -1, startTime: 1 })
      .lean();

    if (!includeProducts) {
      return NextResponse.json({ deals });
    }

    // Fetch product details for each deal
    const dealsWithProducts = await Promise.all(
      deals.map(async (deal) => {
        if (!deal.productIds || deal.productIds.length === 0) {
          return { ...deal, products: [] };
        }

        const products = await Product.find({ _id: { $in: deal.productIds } })
          .select('name slug price AED images category inStock fastDelivery imageAspectRatio')
          .lean();

        return { ...deal, products };
      })
    );

    return NextResponse.json({ deals: dealsWithProducts });
  } catch (error) {
    console.error('GET /api/store/deals error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// POST: Create a new deal
export async function POST(request) {
  try {
    await connectDB();

    const userId = await getUserIdFromRequest(request);
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, productIds, startTime, endTime, priority } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ 
        error: 'Title, start time, and end time are required' 
      }, { status: 400 });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return NextResponse.json({ 
        error: 'End time must be after start time' 
      }, { status: 400 });
    }

    const deal = await Deal.create({
      storeId,
      title,
      productIds: productIds || [],
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      priority: priority || 0,
      isActive: true
    });

    return NextResponse.json({ 
      success: true, 
      deal: deal.toObject() 
    });
  } catch (error) {
    console.error('POST /api/store/deals error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
