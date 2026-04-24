export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Deal from '@/models/Deal';
import authSeller from '@/middlewares/authSeller';
import { auth } from "@/lib/firebase-admin";

const getUserIdFromRequest = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const adminAuth = auth;
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    return null;
  }
};

// GET: Get single deal
export async function GET(request, { params }) {
  try {
    await connectDB();

    const userId = await getUserIdFromRequest(request);
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await Deal.findOne({ _id: dealId, storeId }).lean();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({ deal });
  } catch (error) {
    console.error('GET /api/store/deals/[dealId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// PATCH: Update a deal
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const userId = await getUserIdFromRequest(request);
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await params;
    const body = await request.json();
    const { title, productIds, startTime, endTime, isActive, priority } = body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (productIds !== undefined) updateData.productIds = productIds;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;

    if (updateData.startTime && updateData.endTime && updateData.endTime <= updateData.startTime) {
      return NextResponse.json({ 
        error: 'End time must be after start time' 
      }, { status: 400 });
    }

    const deal = await Deal.findOneAndUpdate(
      { _id: dealId, storeId },
      updateData,
      { new: true }
    );

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      deal: deal.toObject() 
    });
  } catch (error) {
    console.error('PATCH /api/store/deals/[dealId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete a deal
export async function DELETE(request, { params }) {
  try {
    await connectDB();

    const userId = await getUserIdFromRequest(request);
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await params;
    const deal = await Deal.findOneAndDelete({ _id: dealId, storeId });

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Deal deleted successfully' 
    });
  } catch (error) {
    console.error('DELETE /api/store/deals/[dealId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
