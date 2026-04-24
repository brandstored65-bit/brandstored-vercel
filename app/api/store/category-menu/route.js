export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import StoreMenu from '@/models/StoreMenu';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';

function slugify(text = '') {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildCategoryUrl(name = '') {
  const slug = slugify(name);
  return slug ? `/${slug}` : '/';
}

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

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    await dbConnect();
    let storeMenu = await StoreMenu.findOne({ storeId });

    // Backward compatibility: old records were saved by userId instead of shared storeId.
    // If a proper storeId document already exists, remove the legacy one to avoid duplicate-key errors.
    if (!storeMenu) {
      const legacyStoreMenu = await StoreMenu.findOne({ storeId: userId });
      if (legacyStoreMenu) {
        const existingStoreMenu = await StoreMenu.findOne({ storeId });
        if (existingStoreMenu) {
          if (String(existingStoreMenu._id) !== String(legacyStoreMenu._id)) {
            await StoreMenu.deleteOne({ _id: legacyStoreMenu._id });
          }
          storeMenu = existingStoreMenu;
        } else {
          legacyStoreMenu.storeId = storeId;
          await legacyStoreMenu.save();
          storeMenu = legacyStoreMenu;
        }
      }
    }
    
    return NextResponse.json(
      {
        categories: storeMenu?.categories || []
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
      }
    );
  } catch (error) {
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

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    await dbConnect();
    const { categories } = await request.json();

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories must be an array' },
        { status: 400 }
      );
    }

    if (categories.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 categories allowed' },
        { status: 400 }
      );
    }

    const normalizedCategories = categories.map((category) => ({
      ...category,
      name: (category?.name || '').trim(),
      url: category?.url || buildCategoryUrl(category?.name || ''),
    }));

    // Migrate legacy key if exists for this user, but avoid unique index collision.
    const legacyStoreMenu = await StoreMenu.findOne({ storeId: userId });
    if (legacyStoreMenu && legacyStoreMenu.storeId !== storeId) {
      const existingStoreMenu = await StoreMenu.findOne({ storeId });
      if (existingStoreMenu) {
        if (String(existingStoreMenu._id) !== String(legacyStoreMenu._id)) {
          await StoreMenu.deleteOne({ _id: legacyStoreMenu._id });
        }
      } else {
        legacyStoreMenu.storeId = storeId;
        await legacyStoreMenu.save();
      }
    }

    const storeMenu = await StoreMenu.findOneAndUpdate(
      { storeId },
      { 
        storeId,
        categories: normalizedCategories
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ storeMenu }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
