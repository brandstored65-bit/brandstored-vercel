import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import AbandonedCart from "@/models/AbandonedCart";
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";
import { migrateProductsToActiveStore } from "@/lib/migrateProductsToActiveStore";

// Next.js API route handler for GET
export async function GET(request) {
   try {
   const requestStartedAt = Date.now();
      // Firebase Auth: Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
         decodedToken = await getAuth().verifyIdToken(idToken);
      } catch (e) {
         return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      const userId = decodedToken.uid;
      const storeId = await authSeller(userId);
      if (!storeId) {
         return NextResponse.json({ error: 'Forbidden: Seller not approved or no store found.' }, { status: 403 });
      }

      const dbConnectStartedAt = Date.now();
      await dbConnect();
      const dbConnectMs = Date.now() - dbConnectStartedAt;

      const migration = await migrateProductsToActiveStore({ userId, activeStoreId: storeId });

      const queriesStartedAt = Date.now();
      const [
         totalOrders,
         totalProducts,
         abandonedCarts,
         uniqueCustomerIds,
         orderRevenue,
         productIds,
      ] = await Promise.all([
         Order.countDocuments({ storeId }),
         Product.countDocuments({ storeId }),
         AbandonedCart.countDocuments({ storeId }),
         Order.distinct('userId', { storeId }),
         Order.aggregate([
            { $match: { storeId } },
            { $group: { _id: null, totalEarnings: { $sum: { $ifNull: ['$total', 0] } } } }
         ]),
         Product.distinct('_id', { storeId }),
      ]);
      const parallelQueriesMs = Date.now() - queriesStartedAt;

      const ratingsStartedAt = Date.now();
      const totalRatings = productIds.length
         ? await Rating.countDocuments({ productId: { $in: productIds } })
         : 0;
      const ratingsQueryMs = Date.now() - ratingsStartedAt;

      const dashboardData = {
         ratings: [],
         totalRatings,
         totalOrders,
         totalEarnings: Math.round(orderRevenue?.[0]?.totalEarnings || 0),
         totalProducts,
         totalCustomers: uniqueCustomerIds.length,
         abandonedCarts,
      };

      const totalMs = Date.now() - requestStartedAt;
      console.info('[store/dashboard] timing', {
         totalMs,
         dbConnectMs,
         parallelQueriesMs,
         ratingsQueryMs,
         migratedProducts: migration.migratedCount,
         totalOrders,
         totalProducts,
         totalCustomers: uniqueCustomerIds.length,
      });

      const response = NextResponse.json({ dashboardData });
      response.headers.set('x-dashboard-api-ms', String(totalMs));
      return response;
   } catch (error) {
      console.error(error);
      return NextResponse.json({ error: error.code || error.message }, { status: 400 });
   }
}