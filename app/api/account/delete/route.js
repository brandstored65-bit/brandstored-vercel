export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { auth } from "@/lib/firebase-admin";
import User from '@/models/User';
import Address from '@/models/Address';
import Order from '@/models/Order';
import Wallet from '@/models/Wallet';
import Ticket from '@/models/Ticket';
import WishlistItem from '@/models/WishlistItem';
import BrowseHistory from '@/models/BrowseHistory';
import RecentSearch from '@/models/RecentSearch';
import AbandonedCart from '@/models/AbandonedCart';
import ReturnRequest from '@/models/ReturnRequest';
import Rating from '@/models/Rating';
import StoreUser from '@/models/StoreUser';
import GuestUser from '@/models/GuestUser';

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const deletions = await Promise.all([
      User.deleteOne({ _id: userId }),
      Address.deleteMany({ userId }),
      Order.deleteMany({ userId }),
      Wallet.deleteOne({ userId }),
      Ticket.deleteMany({ userId }),
      WishlistItem.deleteMany({ userId }),
      BrowseHistory.deleteMany({ userId }),
      RecentSearch.deleteMany({ userId }),
      AbandonedCart.deleteMany({ userId }),
      ReturnRequest.deleteMany({ userId }),
      Rating.deleteMany({ userId }),
      StoreUser.deleteMany({ userId }),
      GuestUser.deleteMany({ convertedUserId: userId })
    ]);

    try {
      await auth.deleteUser(userId);
    } catch (authError) {
      console.error('Auth delete failed:', authError);
      return NextResponse.json({
        error: 'Account data deleted, but authentication removal failed. Please contact support.'
      }, { status: 500 });
    }

    const deletedCounts = {
      user: deletions[0]?.deletedCount || 0,
      addresses: deletions[1]?.deletedCount || 0,
      orders: deletions[2]?.deletedCount || 0,
      wallet: deletions[3]?.deletedCount || 0,
      tickets: deletions[4]?.deletedCount || 0,
      wishlist: deletions[5]?.deletedCount || 0,
      browseHistory: deletions[6]?.deletedCount || 0,
      recentSearch: deletions[7]?.deletedCount || 0,
      abandonedCarts: deletions[8]?.deletedCount || 0,
      returnRequests: deletions[9]?.deletedCount || 0,
      ratings: deletions[10]?.deletedCount || 0,
      storeUsers: deletions[11]?.deletedCount || 0,
      guestUsers: deletions[12]?.deletedCount || 0
    };

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      deleted: deletedCounts
    });
  } catch (error) {
    console.error('Account delete error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete account' }, { status: 500 });
  }
}
