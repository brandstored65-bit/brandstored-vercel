export const dynamic = 'force-dynamic'

import dbConnect from '@/lib/mongodb';
import RecentSearch from '@/models/RecentSearch';
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

// GET - Fetch recent searches for logged in user
export async function GET(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const recentSearch = await RecentSearch.findOne({ userId }).lean();
    
    return NextResponse.json({ 
      searches: recentSearch?.searches || [] 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch searches' },
      { status: 500 }
    );
  }
}

// POST - Add a new search term
export async function POST(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    const { searchTerm } = await req.json();

    if (!searchTerm || !searchTerm.trim()) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      );
    }

    const trimmedTerm = searchTerm.trim().toLowerCase();

    // Find existing or create new
    let recentSearch = await RecentSearch.findOne({ userId });

    if (!recentSearch) {
      recentSearch = new RecentSearch({
        userId,
        searches: [trimmedTerm],
      });
    } else {
      // Remove if already exists (to move to front)
      recentSearch.searches = recentSearch.searches.filter(s => s !== trimmedTerm);
      
      // Add to front
      recentSearch.searches.unshift(trimmedTerm);
      
      // Keep only last 20
      if (recentSearch.searches.length > 20) {
        recentSearch.searches = recentSearch.searches.slice(0, 20);
      }
    }

    await recentSearch.save();

    return NextResponse.json(
      { message: 'Search saved', searches: recentSearch.searches },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving search:', error);
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all recent searches
export async function DELETE(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    await RecentSearch.findOneAndUpdate(
      { userId },
      { searches: [] },
      { upsert: true }
    );

    return NextResponse.json(
      { message: 'Searches cleared' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error clearing searches:', error);
    return NextResponse.json(
      { error: 'Failed to clear searches' },
      { status: 500 }
    );
  }
}
