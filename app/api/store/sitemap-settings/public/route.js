export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import SitemapSettings from '@/models/SitemapSettings';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    await dbConnect();
    
    // Get the first store's sitemap settings (or you can modify this logic)
    // For now, we'll try to get from the first store that has configured settings
    const settings = await SitemapSettings.findOne({
      enabled: true,
      categories: { $exists: true, $ne: [] }
    }).lean();

    if (settings && settings.categories && settings.enabled) {
      return NextResponse.json({
        categories: settings.categories
      }, { status: 200 });
    }

    return NextResponse.json({
      categories: []
    }, { status: 200 });
  } catch (error) {
    console.error('[API /store/sitemap-settings/public GET] error:', error);
    return NextResponse.json(
      { categories: [] },
      { status: 200 }
    );
  }
}
