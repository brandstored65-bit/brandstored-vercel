import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import StoreUser from '@/models/StoreUser';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Delete the store user
    await StoreUser.deleteOne({ 
      storeId,
      email: userEmail 
    });

    return NextResponse.json({ message: 'User removed successfully' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
