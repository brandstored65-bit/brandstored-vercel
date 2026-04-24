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

export async function GET(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const storeId = decoded.uid;

    const sections = await FeaturedSection.find({ storeId }).lean();

    return NextResponse.json({ sections: sections || [] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching featured sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const storeId = decoded.uid;

    const { title, productIds } = await req.json();

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one product is required' },
        { status: 400 }
      );
    }

    const section = new FeaturedSection({
      storeId,
      title: title.trim(),
      productIds,
    });

    await section.save();

    return NextResponse.json(
      { message: 'Section created', section },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating featured section:', error);
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await auth.verifyIdToken(token);
    const storeId = decoded.uid;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Section ID is required' }, { status: 400 });
    }

    const section = await FeaturedSection.findOneAndDelete({ _id: id, storeId });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Section deleted' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting featured section:', error);
    return NextResponse.json(
      { error: 'Failed to delete section' },
      { status: 500 }
    );
  }
}
