export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    await dbConnect();
    
    // Get all sliders raw from DB
    const sliders = await CategorySlider.find({}).lean();
    
    // Log each slider's subtitle
    const debug = sliders.map(s => ({
      id: s._id?.toString(),
      title: s.title,
      subtitle: s.subtitle,
      hasSubtitle: 'subtitle' in s,
      subtitleType: typeof s.subtitle
    }));
    
    return NextResponse.json({ 
      count: sliders.length,
      sliders: debug,
      raw: sliders
    }, { status: 200 });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
