export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// GET /api/home/sections
// Returns active homepage selections with product details and optional slides
export async function GET() {
  try {
    // If database env is missing (build/preview), return empty payload gracefully
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ sections: [] });
    }
    await dbConnect();
    const selections = await HomeSection.find({ isActive: true }).sort({ sortOrder: 1 }).lean();

    // Map each selection to include product data in the provided order
    const payload = await Promise.all(
      selections.map(async (sel) => {
        let products = [];
        if (sel.productIds?.length) {
          const found = await Product.find({
            _id: { $in: sel.productIds }
          }).select('_id name price mrp AED images inStock').lean();
          // Preserve order based on productIds
          const byId = new Map(found.map((p) => [p._id.toString(), p]));
          products = sel.productIds
            .map((id) => byId.get(id))
            .filter(Boolean)
            .map((p) => ({
              ...p,
              id: p._id.toString(),
              image: p.images?.[0] || null,
              offLabel:
                p.AED && p.AED > p.price
                  ? `Min. ${Math.max(0, Math.round(((p.AED - p.price) / p.AED) * 100))}% Off`
                  : null,
            }));
        }

        return {
          id: sel._id.toString(),
          key: sel.section,
          title: sel.title,
          subtitle: sel.subtitle,
          slides: sel.slides || [],
          layout: sel.layout,
          bannerCtaText: sel.bannerCtaText,
          bannerCtaLink: sel.bannerCtaLink,
          products,
        };
      })
    );

    return NextResponse.json({ sections: payload });
  } catch (error) {
    console.error("/api/home/sections error", error);
    // Degrade gracefully for homepage; avoid noisy 500 in client console
    return NextResponse.json({ sections: [] });
  }
}
