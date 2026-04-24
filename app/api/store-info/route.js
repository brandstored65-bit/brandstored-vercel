export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Store from "@/models/Store";

// GET - Fetch store info (public endpoint - no auth required)
export async function GET(request) {
  try {
    await connectDB();

    // Try to get the first approved/active store
    let store = await Store.findOne({ 
      $or: [
        { isActive: true },
        { status: 'approved' }
      ]
    }).lean();
    
    // If no active store, get the first store (any status)
    if (!store) {
      store = await Store.findOne().lean();
    }
    
    console.log('Store-info API called');
    console.log('Store found:', store ? { _id: store._id, name: store.name, userId: store.userId } : 'NOT FOUND');

    if (!store) {
      console.error('Store not found in database');
      
      // Count total stores to see if any exist
      const storeCount = await Store.countDocuments();
      console.log('Total stores in database:', storeCount);
      
      // Get all stores to debug
      const allStores = await Store.find({}).select('_id name userId status isActive').lean();
      console.log('All stores:', allStores);
      
      return NextResponse.json(
        { 
          error: "No store found",
          totalStores: storeCount,
          stores: allStores,
          hint: storeCount === 0 ? "No stores exist. Create one first." : "Store exists but query failed"
        },
        { status: 404 }
      );
    }

    const response = {
      success: true,
      store: {
        _id: store._id.toString(),
        name: store.name,
        slug: store.slug || store.username,
      },
    };

    console.log('Returning store info:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching store info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch store info" },
      { status: 500 }
    );
  }
}
