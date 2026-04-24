export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'image.jpg';

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Get authorization token from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Verify token exists (basic check - optional token validation)
    const token = authHeader.replace('Bearer ', '');
    if (!token || token.length < 10) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 401 }
      );
    }

    console.log('[DOWNLOAD IMAGE] Fetching image:', imageUrl.substring(0, 50) + '...');

    // Fetch image from the URL with timeout
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('[DOWNLOAD IMAGE] Success - Content-Type:', response.headers['content-type']);

    // Return image with proper headers for download
    return new NextResponse(response.data, {
      headers: {
        'Content-Type': response.headers['content-type'] || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': response.data.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    console.error('[DOWNLOAD IMAGE ERROR]:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url?.substring(0, 100),
    });

    return NextResponse.json(
      { 
        error: error.response?.statusText || error.message || 'Failed to download image',
        status: error.response?.status,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: error.response?.status || 500 }
    );
  }
}
