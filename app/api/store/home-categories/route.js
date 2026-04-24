export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import HomeCategorySettings from '@/models/HomeCategorySettings';
import { auth } from "@/lib/firebase-admin";
import { NextResponse } from 'next/server';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(request) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = auth;
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();
    const settings = await HomeCategorySettings.findOne({ storeId: userId });

    return NextResponse.json({
      categories: settings?.categories || []
    }, { status: 200 });
  } catch (error) {
    console.error('[API /store/home-categories GET] error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = auth;
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();
    const { categories } = await request.json();

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories must be an array' },
        { status: 400 }
      );
    }

    if (categories.length > 12) {
      return NextResponse.json(
        { error: 'Maximum 12 categories allowed' },
        { status: 400 }
      );
    }

    const settings = await HomeCategorySettings.findOneAndUpdate(
      { storeId: userId },
      {
        storeId: userId,
        categories: categories
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    console.error('[API /store/home-categories POST] error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
