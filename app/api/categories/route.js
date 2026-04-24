export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';

// GET - Fetch all categories (public endpoint)
export async function GET(req) {
    try {
        await connectDB();
        
        // Get all categories
        const categories = await Category.find({}).sort({ name: 1 }).lean();
        
        // Populate children for each category
        const categoriesWithChildren = await Promise.all(
            categories.map(async (cat) => {
                const children = await Category.find({ parentId: cat._id.toString() }).sort({ name: 1 }).lean();
                return { ...cat, children };
            })
        );

        return NextResponse.json({ categories: categoriesWithChildren }, { status: 200 });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
