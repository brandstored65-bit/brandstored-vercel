export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import FeaturedSection from '@/models/FeaturedSection';
import { NextResponse } from 'next/server';
import { auth } from "@/lib/firebase-admin";

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const storeId = decoded.uid;
    const { id } = params;

    const { title, productIds } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const section = await FeaturedSection.findOneAndUpdate(
      { _id: id, storeId },
      {
        title: title.trim(),
        productIds,
      },
      { new: true }
    );

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Section updated', section },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating featured section:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const storeId = decoded.uid;
    const { id } = params;

    const section = await FeaturedSection.findOneAndDelete({ _id: id, storeId });

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Section deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting featured section:', error);
    return NextResponse.json(
      { error: 'Failed to delete section' },
      { status: 500 }
    );
  }
}
