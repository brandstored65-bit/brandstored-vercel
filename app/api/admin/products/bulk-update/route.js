export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    await dbConnect();

    // Admin auth via Firebase token
    const authHeader = request.headers.get('authorization');
    let isAdmin = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];

      try {
        const decoded = await auth.verifyIdToken(idToken);
        const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').replace(/['\"]/g, '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        const email = String(decoded?.email || '').toLowerCase();
        isAdmin = adminEmails.includes(email);
      } catch (e) {
        console.warn('Admin bulk update auth failed', e?.message || e);
      }
    }

    if (!isAdmin) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

    const body = await request.json();
    const { ids, set } = body;
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'missing ids' }, { status: 400 });
    if (!set || typeof set !== 'object') return NextResponse.json({ error: 'missing set object' }, { status: 400 });

    // Validate allowed keys
    const allowed = ['codEnabled', 'onlinePaymentEnabled'];
    const update = {};
    for (const key of Object.keys(set)) {
      if (allowed.includes(key)) update[key] = Boolean(set[key]);
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });

    const res = await Product.updateMany({ _id: { $in: ids } }, { $set: update });
    return NextResponse.json({ message: 'updated', modifiedCount: res.modifiedCount });
  } catch (error) {
    console.error('Bulk update error', error);
    return NextResponse.json({ error: error.message || 'error' }, { status: 500 });
  }
}
