export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request) {
  try {
    await connectDB();

    // Firebase Auth: Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 });
    }
    
    // Verify Firebase token
    const { getAuth } = await import('firebase-admin/auth');
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    
    try {
      if (getApps().length === 0) {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountKey) {
          return NextResponse.json({ error: 'Firebase not configured' }, { status: 500 });
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        initializeApp({ credential: cert(serviceAccount) });
      }
    } catch (initError) {
      console.error('Firebase initialization error:', initError);
      return NextResponse.json({ error: 'Firebase initialization failed' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Create/update user in database
    await User.findOneAndUpdate(
      { _id: userId },
      { 
        $setOnInsert: { 
          _id: userId,
          email: email,
          name: name || '',
          image: '',
          cart: []
        }
      },
      { upsert: true, new: true }
    );

    // Send welcome email
    await sendWelcomeEmail(email, name);

    return NextResponse.json({ 
      success: true, 
      message: 'Welcome email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({ 
      error: 'Failed to send welcome email',
      details: error.message 
    }, { status: 500 });
  }
}
