import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        const { productIds } = await req.json();

        if (!productIds || !Array.isArray(productIds)) {
            return NextResponse.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        if (productIds.length === 0) {
            return NextResponse.json({ products: [] });
        }

        const products = await Product.find({ _id: { $in: productIds } })
            .select('name slug price mrp AED images category categories inStock fastDelivery freeShippingEligible imageAspectRatio shortDescription sku hasVariants variants allowReturn allowReplacement')
            .lean();

        // Preserve order of productIds in response
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        const orderedProducts = productIds
            .map(id => productMap.get(id))
            .filter(Boolean);

        return NextResponse.json({ products: orderedProducts });
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}
