export const dynamic = 'force-dynamic'

import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import AbandonedCart from "@/models/AbandonedCart";
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase-admin";
import { migrateProductsToActiveStore } from "@/lib/migrateProductsToActiveStore";

const PENDING_PAYMENT_STATUSES = new Set(['failed', 'payment_failed', 'refunded', 'unpaid', 'pending']);
const IN_TRANSIT_STATUSES = new Set([
   'PROCESSING',
   'WAITING_FOR_PICKUP',
   'PICKUP_REQUESTED',
   'PICKED_UP',
   'WAREHOUSE_RECEIVED',
   'SHIPPED',
   'OUT_FOR_DELIVERY',
]);

const normalizePaymentMethod = (value) => String(value || '').trim().toLowerCase();
const normalizePaymentStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeOrderStatus = (value) => String(value || '').trim().toUpperCase();

const isOrderPaid = (order) => {
   const paymentMethod = normalizePaymentMethod(order?.paymentMethod);
   const orderStatus = normalizeOrderStatus(order?.status);
   const paymentStatus = normalizePaymentStatus(order?.paymentStatus);
   const hasPaidFlag = !!order?.isPaid;

   if (paymentMethod === 'cod') {
      if (orderStatus === 'DELIVERED') return true;
      if (order?.delhivery?.payment?.is_cod_recovered) return true;
      return hasPaidFlag;
   }

   if (paymentMethod) {
      const failedStatuses = new Set(['failed', 'payment_failed', 'refunded', 'unpaid']);
      if (hasPaidFlag) return true;
      if (failedStatuses.has(paymentStatus)) return false;
      if (orderStatus === 'PAYMENT_FAILED') return false;
      if (paymentStatus === 'pending') return false;
      return false;
   }

   return hasPaidFlag;
};

const getRangeDate = (value, endOfDay = false) => {
   if (!value) return null;
   const parsed = new Date(value);
   if (Number.isNaN(parsed.getTime())) return null;
   if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      if (endOfDay) {
         parsed.setHours(23, 59, 59, 999);
      } else {
         parsed.setHours(0, 0, 0, 0);
      }
   }
   return parsed;
};

// Next.js API route handler for GET
export async function GET(request) {
   try {
   const requestStartedAt = Date.now();
      const { searchParams } = new URL(request.url);
      const rangeStart = getRangeDate(searchParams.get('from'));
      const rangeEnd = getRangeDate(searchParams.get('to'), true);

      // Firebase Auth: Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
         decodedToken = await auth.verifyIdToken(idToken);
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
         totalProducts,
         abandonedCarts,
         uniqueCustomerIds,
         productIds,
         orderDocs,
      ] = await Promise.all([
         Product.countDocuments({ storeId }),
         AbandonedCart.countDocuments({ storeId, recoveredAt: null }),
         Order.distinct('userId', { storeId }),
         Product.distinct('_id', { storeId }),
         Order.find({ storeId })
            .select('total status paymentMethod paymentStatus isPaid createdAt orderItems userId guestEmail delhivery')
            .lean(),
      ]);
      const parallelQueriesMs = Date.now() - queriesStartedAt;

      const ratingsStartedAt = Date.now();
      const totalRatings = productIds.length
         ? await Rating.countDocuments({ productId: { $in: productIds } })
         : 0;
      const ratingsQueryMs = Date.now() - ratingsStartedAt;

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const totalOrders = orderDocs.length;
      const totalEarnings = Math.round(orderDocs.reduce((sum, order) => sum + Number(order?.total || 0), 0));
      const overview = {
         todayOrders: 0,
         totalDelivered: 0,
         paidByCard: 0,
         codOrders: 0,
         inTransit: 0,
         pendingPayment: 0,
         cancelled: 0,
         deliveredEarnings: 0,
      };

      const productRangeMap = new Map();
      const rangeProductIds = new Set();
      const rangeSummary = {
         from: rangeStart ? rangeStart.toISOString() : null,
         to: rangeEnd ? rangeEnd.toISOString() : null,
         ordersInRange: 0,
         unitsSoldInRange: 0,
         products: [],
      };

      for (const order of orderDocs) {
         const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
         const status = normalizeOrderStatus(order?.status);
         const paymentMethod = normalizePaymentMethod(order?.paymentMethod);
         const paid = isOrderPaid(order);

         if (createdAt && createdAt >= todayStart && createdAt <= todayEnd) {
            overview.todayOrders += 1;
         }

         if (status === 'DELIVERED') {
            overview.totalDelivered += 1;
            overview.deliveredEarnings += Number(order?.total || 0);
         }

         if (paymentMethod && paymentMethod !== 'cod' && paid) {
            overview.paidByCard += 1;
         }

         if (paymentMethod === 'cod') {
            overview.codOrders += 1;
         }

         if (IN_TRANSIT_STATUSES.has(status)) {
            overview.inTransit += 1;
         }

         if (!paid) {
            overview.pendingPayment += 1;
         }

         if (status === 'CANCELLED') {
            overview.cancelled += 1;
         }

         const withinRange = (!rangeStart || (createdAt && createdAt >= rangeStart)) && (!rangeEnd || (createdAt && createdAt <= rangeEnd));
         if (!withinRange) continue;

         rangeSummary.ordersInRange += 1;
         const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
         for (const item of orderItems) {
            const quantity = Number(item?.quantity || 0);
            if (!quantity) continue;
            rangeSummary.unitsSoldInRange += quantity;

            const normalizedProductId = item?.productId ? String(item.productId) : null;
            if (normalizedProductId) {
               rangeProductIds.add(normalizedProductId);
            }

            const fallbackName =
               item?.name ||
               item?.productName ||
               item?.title ||
               item?.product?.name ||
               item?.productId?.name ||
               null;

            const key = String(normalizedProductId || fallbackName || 'unknown');
            const current = productRangeMap.get(key) || {
               productId: normalizedProductId || key,
               name: fallbackName,
               units: 0,
               orders: 0,
            };
            current.units += quantity;
            current.orders += 1;
            productRangeMap.set(key, current);
         }
      }

      overview.deliveredEarnings = Math.round(overview.deliveredEarnings);
      if (rangeProductIds.size > 0) {
         const productsInRange = await Product.find({ _id: { $in: Array.from(rangeProductIds) } })
            .select('name title')
            .lean();

         const productNameMap = new Map(
            productsInRange.map((product) => [String(product._id), product.name || product.title || null])
         );

         for (const entry of productRangeMap.values()) {
            if (!entry.name && productNameMap.has(entry.productId)) {
               entry.name = productNameMap.get(entry.productId);
            }
            if (!entry.name) {
               entry.name = 'Unnamed Product';
            }
         }
      } else {
         for (const entry of productRangeMap.values()) {
            if (!entry.name) {
               entry.name = 'Unnamed Product';
            }
         }
      }

      rangeSummary.products = Array.from(productRangeMap.values()).sort((a, b) => b.units - a.units);

      const dashboardData = {
         ratings: [],
         totalRatings,
         totalOrders,
         totalEarnings,
         totalProducts,
         totalCustomers: uniqueCustomerIds.length,
         abandonedCarts,
         overview,
         rangeSummary,
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
