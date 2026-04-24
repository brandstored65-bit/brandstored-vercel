export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import imagekit from '../../../../../configs/imageKit';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    // Parse the form with formidable
    const form = new formidable.IncomingForm();
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });
    const file = data.files.image;
    if (!file) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }
    // Read file buffer
    const buffer = fs.readFileSync(file.filepath);
    // Upload to ImageKit
    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: file.originalFilename,
      folder: '/profile-images/',
    });
    return NextResponse.json({ url: uploadResponse.url });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
