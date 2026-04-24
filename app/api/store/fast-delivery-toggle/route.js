export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import authSeller from "@/middlewares/authSeller";

export async function POST(request) {
  try {
    // Extract userId from Firebase token in Authorization header
    const authHeader = request.headers.get("authorization");
    let userId = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split(" ")[1];
      const { getAuth } = await import("firebase-admin/auth");
      const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
      if (getApps().length === 0) {
        initializeApp({ credential: applicationDefault() });
      }
      try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (e) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const storeId = await authSeller(userId);
    if (!storeId) return Response.json({ error: "Not authorized as seller" }, { status: 401 });

    const { productId } = await request.json();
    if (!productId) {
      return Response.json({ error: "Product ID is required" }, { status: 400 });
    }

    await dbConnect();

    // Fetch the product document (do NOT use .lean() since we need a Mongoose document)
    const product = await Product.findById(productId);
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify the product belongs to the seller's store
    if (product.storeId !== storeId) {
      return Response.json({ error: "Unauthorized to modify this product" }, { status: 403 });
    }

    // Toggle fast delivery and persist
    product.fastDelivery = !product.fastDelivery;
    await product.save();

    return Response.json({ 
      message: product.fastDelivery ? "Fast delivery enabled" : "Fast delivery disabled",
      fastDelivery: product.fastDelivery 
    });
  } catch (error) {
    console.error("Error toggling fast delivery:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
