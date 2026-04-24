export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EmailHistory from '@/models/EmailHistory';
import authSeller from '@/middlewares/authSeller';

export async function GET(request) {
  try {
    await dbConnect();

    // Extract and verify token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const storeId = await authSeller(userId);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    console.log('[email-history] userId:', userId, 'storeId:', storeId);

    // Convert storeId to ObjectId for proper query
    const mongoose = await import('mongoose');
    const storeObjectId = new mongoose.default.Types.ObjectId(storeId);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Build query
    let query = { storeId: storeObjectId };
    if (status) query.status = status;
    if (type) query.type = type;

    console.log('[email-history] Query:', query);

    // Fetch email history
    const skip = (page - 1) * limit;
    const history = await EmailHistory.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    console.log('[email-history] Found records:', history.length);

    // Get total count
    const total = await EmailHistory.countDocuments(query);

    console.log('[email-history] Total records:', total);

    // Get summary stats
    const statsMatch = { storeId: storeObjectId };
    if (type) statsMatch.type = type;
    const stats = await EmailHistory.aggregate([
      { $match: statsMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsByStatus = {
      sent: 0,
      failed: 0,
      pending: 0
    };
    stats.forEach(stat => {
      statsByStatus[stat._id] = stat.count;
    });

    console.log('[email-history] Stats:', statsByStatus);

    return NextResponse.json({
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: statsByStatus
    });
  } catch (error) {
    console.error('[email-history API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
