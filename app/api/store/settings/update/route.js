export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import admin from 'firebase-admin';

export async function POST(request) {
  try {
    await connectDB();

    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
      });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const body = await request.json();
    const {
      name,
      email,
      contact,
      description,
      address,
      logo,
      banner,
      website,
      facebook,
      instagram,
      twitter,
      businessHours,
      returnPolicy,
      shippingPolicy
    } = body;

    // Find and update store
    const store = await Store.findOneAndUpdate(
      { userId },
      {
        $set: {
          name,
          email,
          contact,
          description,
          address,
          logo,
          banner,
          website,
          facebook,
          instagram,
          twitter,
          businessHours,
          returnPolicy,
          shippingPolicy
        }
      },
      { new: true, runValidators: true }
    );

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Store settings updated successfully',
      store 
    });

  } catch (error) {
    console.error('Store settings update error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update store settings' 
    }, { status: 500 });
  }
}
