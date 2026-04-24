export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import NavbarMenuSettings from '@/models/NavbarMenuSettings';
import { NextResponse } from 'next/server';
import { auth } from "@/lib/firebase-admin";

const MAX_ITEMS = 12;

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(req) {
  try {
    await dbConnect();

    const token = parseAuthHeader(req);
    if (token) {
      try {
        const decoded = await auth.verifyIdToken(token);
        const settings = await NavbarMenuSettings.findOne({ storeId: decoded.uid }).lean();
        return NextResponse.json(
          {
            enabled: settings?.enabled ?? true,
            items: settings?.items || [],
          },
          { status: 200 }
        );
      } catch (error) {
        console.warn('[API /store/navbar-menu GET] token verify failed:', error?.message || error);
      }
    }

    const settings = await NavbarMenuSettings.findOne({
      enabled: true,
      items: { $exists: true, $ne: [] },
    })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(
      {
        enabled: settings?.enabled ?? false,
        items: settings?.items || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /store/navbar-menu GET] error:', error);
    return NextResponse.json({ enabled: false, items: [] }, { status: 200 });
  }
}

export async function POST(req) {
  try {
    const token = parseAuthHeader(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();

    const body = await req.json();
    const { enabled = true, items = [] } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one menu item is required' }, { status: 400 });
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_ITEMS} items allowed` }, { status: 400 });
    }

    const sanitizedItems = items.map((item, index) => {
      const label = (item?.label || '').trim();
      const url = (item?.url || '').trim();
      const categoryId = (item?.categoryId || '').trim();

      if (!label) {
        throw new Error(`Item ${index + 1}: Label is required`);
      }
      if (!url) {
        throw new Error(`Item ${index + 1}: URL is required`);
      }

      return { label, url, categoryId: categoryId || null };
    });

    const settings = await NavbarMenuSettings.findOneAndUpdate(
      { storeId: userId },
      { storeId: userId, enabled: !!enabled, items: sanitizedItems },
      { upsert: true, new: true }
    );

    return NextResponse.json(
      {
        message: 'Navbar menu updated',
        data: { enabled: settings.enabled, items: settings.items },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /store/navbar-menu POST] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save menu' }, { status: 500 });
  }
}
