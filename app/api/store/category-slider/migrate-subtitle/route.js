export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function POST(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;

    // Update all sliders for this store that don't have a subtitle field
    const result = await CategorySlider.updateMany(
      { 
        storeId,
        $or: [
          { subtitle: { $exists: false } },
          { subtitle: null }
        ]
      },
      { 
        $set: { subtitle: '' } 
      }
    );

    console.log('🔧 Migration result:', result);

    return NextResponse.json({
      message: 'Migration completed',
      matched: result.matchedCount,
      modified: result.modifiedCount
    }, { status: 200 });

  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}
