import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// Get store info & store products
export async function GET(request){
    try {
        await dbConnect();
        // Get store username from query params
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username').toLowerCase();

        if(!username){
            return NextResponse.json({error: "missing username"}, { status: 400 });
        }

        // Get store info and inStock products with ratings
        const store = await Store.findOne({username, isActive: true}).lean();

        if(!store){
            return NextResponse.json({error: "store not found"}, { status: 400 });
        }

        // Get products for this store
        const products = await Product.find({storeId: store._id.toString()})
          .select('_id name slug images price mrp AED category categories inStock stockQuantity')
          .lean();
        store.Product = products;

        return NextResponse.json({store});
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}