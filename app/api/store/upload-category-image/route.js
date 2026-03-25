import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import imagekit from '@/configs/imageKit';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function POST(req) {
  try {
    const token = parseAuthHeader(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await getAuth().verifyIdToken(token);

    const body = await req.json();
    const { base64Image, fileName } = body;

    if (!base64Image) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Validate base64 format
    if (!base64Image.startsWith('data:')) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be base64 data URL.' },
        { status: 400 }
      );
    }

    // Extract media type for file extension
    const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Invalid base64 format' },
        { status: 400 }
      );
    }

    const mimeType = matches[1];

    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const extension = extensionMap[mimeType] || '.jpg';
    const fileNameWithExt = `${fileName || `category-${Date.now()}`}${extension}`;

    const uploadedData = await imagekit.upload({
      file: base64Image,
      fileName: fileNameWithExt,
      folder: '/Brandstored/home-categories'
    });

    return NextResponse.json(
      {
        url: uploadedData.url,
        fileId: uploadedData.fileId,
        message: 'Image uploaded successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error uploading image:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

