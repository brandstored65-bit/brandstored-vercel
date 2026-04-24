export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    await dbConnect();

    // Fetch all category sliders from all stores
    const sliders = await CategorySlider.find({}).lean();

    return NextResponse.json({ sliders: sliders || [] }, { status: 200 });
  } catch (error) {
    console.error('Error fetching public category sliders:', error);
    return NextResponse.json(
      { sliders: [] },
      { status: 200 }
    );
  }
}
