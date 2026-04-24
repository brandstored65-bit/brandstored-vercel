export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    await dbConnect();

    // Fetch all category sliders (sections) to display on homepage
    const sections = await CategorySlider.find({}).lean();

    return NextResponse.json({ sections: sections || [] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching featured sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sections' },
      { status: 500 }
    );
  }
}
