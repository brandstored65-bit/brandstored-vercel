export const dynamic = 'force-dynamic'

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import authSeller from "@/middlewares/authSeller";
import CustomerBehaviorEvent from "@/models/CustomerBehaviorEvent";
import { getAuth } from "@/lib/firebase-admin";

function toDateDaysAgo(days) {
  const now = new Date();
  return new Date(now.getTime() - Number(days || 7) * 24 * 60 * 60 * 1000);
}

function compactIdentity(event) {
  return {
    customerType: event.customerType || "anonymous",
    customerKey: event.customerKey || "",
    customerName: event.customerName || "",
    customerEmail: event.customerEmail || "",
    customerPhone: event.customerPhone || "",
    customerAddress: event.customerAddress || "",
    userId: event.userId || "",
    visitorId: event.visitorId || "",
    sessionId: event.sessionId || "",
  };
}

function buildJourneySteps(timeline) {
  return timeline.map((event) => ({
    at: event.eventAt,
    eventType: event.eventType,
    label: event.eventType.replace(/_/g, " "),
    pagePath: event.pagePath || "",
    productName: event.productName || "",
    nextAction: event.nextAction || "",
    orderId: event.orderId || "",
    orderValue: Number(event.orderValue || 0),
    actionSpentMs: Number(event.actionSpentMs || 0),
  }));
}

function enrichTimelineWithActionSpent(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];

  return timeline.map((event, index) => {
    const ownDurationMs = Number(event.durationMs || 0);
    const nextEvent = timeline[index + 1];

    let actionSpentMs = ownDurationMs > 0 ? ownDurationMs : 0;

    if (actionSpentMs <= 0 && nextEvent?.eventAt && event?.eventAt) {
      const diff = new Date(nextEvent.eventAt).getTime() - new Date(event.eventAt).getTime();
      if (Number.isFinite(diff) && diff > 0) {
        actionSpentMs = diff;
      }
    }

    return {
      ...event,
      actionSpentMs: Math.max(0, Math.round(actionSpentMs)),
      actionLabel: event.nextAction || event.eventType,
    };
  });
}

function buildActionTimeSummary(timeline) {
  const summaryMap = new Map();

  timeline.forEach((event) => {
    const label = event.actionLabel || event.nextAction || event.eventType || "unknown";
    const spent = Number(event.actionSpentMs || 0);
    const existing = summaryMap.get(label) || { action: label, events: 0, totalDurationMs: 0, avgDurationMs: 0 };

    existing.events += 1;
    existing.totalDurationMs += spent;
    summaryMap.set(label, existing);
  });

  const rows = Array.from(summaryMap.values()).map((row) => ({
    ...row,
    avgDurationMs: row.events > 0 ? Math.round(row.totalDurationMs / row.events) : 0,
  }));

  rows.sort((a, b) => b.totalDurationMs - a.totalDurationMs);
  return rows;
}

function resolveIdentityFromTimeline(timeline, fallbackKey) {
  const withIdentity = timeline.find((event) => event.customerName || event.customerEmail || event.customerPhone || event.customerAddress);
  const first = timeline[0] || {};

  return {
    ...compactIdentity(withIdentity || first),
    identifier: (withIdentity?.customerName || withIdentity?.customerEmail || withIdentity?.customerPhone || withIdentity?.userId || fallbackKey || "").trim(),
  };
}

function buildCustomerFilter(customerKey) {
  if (!customerKey) return {};
  const [prefix, ...rest] = String(customerKey).split(':');
  const value = rest.join(':');

  if (!prefix || !value) {
    return { customerKey };
  }

  switch (prefix) {
    case 'user':
      return { $or: [{ customerKey }, { userId: value }] };
    case 'guest':
      return { $or: [{ customerKey }, { visitorId: value }] };
    case 'guest_email':
      return { $or: [{ customerKey }, { customerEmail: value.toLowerCase() }] };
    case 'guest_phone':
      return { $or: [{ customerKey }, { customerPhone: value }] };
    case 'guest_session':
      return { $or: [{ customerKey }, { sessionId: value }] };
    default:
      return { customerKey };
  }
}

export async function GET(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const storeId = await authSeller(decoded.uid);
    if (!storeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = [1, 7, 30, 90].includes(Number(searchParams.get("days"))) ? Number(searchParams.get("days")) : 7;
    const customerKey = String(searchParams.get("customerKey") || "").trim();
    const startDate = toDateDaysAgo(days);

    const baseMatch = { storeId, eventAt: { $gte: startDate } };

    const [
      totalEvents,
      conversionCount,
      sourceBreakdown,
      eventBreakdown,
      pageTimeBreakdown,
      actionTimeBreakdown,
      topProducts,
      recentEvents,
      customerRows,
    ] = await Promise.all([
      CustomerBehaviorEvent.countDocuments(baseMatch),
      CustomerBehaviorEvent.countDocuments({ ...baseMatch, eventType: "order_placed" }),
      CustomerBehaviorEvent.aggregate([
        { $match: baseMatch },
        { $group: { _id: { $ifNull: ["$source", "direct"] }, count: { $sum: 1 } } },
        { $project: { _id: 0, source: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),
      CustomerBehaviorEvent.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $project: { _id: 0, eventType: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),
      CustomerBehaviorEvent.aggregate([
        { $match: { ...baseMatch, durationMs: { $gt: 0 }, pagePath: { $ne: "" } } },
        {
          $group: {
            _id: "$pagePath",
            events: { $sum: 1 },
            totalDurationMs: { $sum: "$durationMs" },
            avgDurationMs: { $avg: "$durationMs" },
            avgScrollDepthPercent: { $avg: "$scrollDepthPercent" },
          },
        },
        {
          $project: {
            _id: 0,
            pagePath: "$_id",
            events: 1,
            totalDurationMs: { $round: ["$totalDurationMs", 0] },
            avgDurationMs: { $round: ["$avgDurationMs", 0] },
            avgScrollDepthPercent: { $round: [{ $ifNull: ["$avgScrollDepthPercent", 0] }, 1] },
          },
        },
        { $sort: { totalDurationMs: -1 } },
        { $limit: 20 },
      ]),
      CustomerBehaviorEvent.aggregate([
        { $match: { ...baseMatch, durationMs: { $gt: 0 } } },
        {
          $addFields: {
            sectionLabel: {
              $cond: [
                { $ne: ["$nextAction", ""] },
                "$nextAction",
                "$eventType",
              ],
            },
          },
        },
        {
          $group: {
            _id: "$sectionLabel",
            events: { $sum: 1 },
            totalDurationMs: { $sum: "$durationMs" },
            avgDurationMs: { $avg: "$durationMs" },
          },
        },
        {
          $project: {
            _id: 0,
            section: "$_id",
            events: 1,
            totalDurationMs: { $round: ["$totalDurationMs", 0] },
            avgDurationMs: { $round: ["$avgDurationMs", 0] },
          },
        },
        { $sort: { totalDurationMs: -1 } },
        { $limit: 20 },
      ]),
      CustomerBehaviorEvent.aggregate([
        { $match: { ...baseMatch, productId: { $ne: "" } } },
        {
          $group: {
            _id: "$productId",
            productName: { $last: "$productName" },
            productSlug: { $last: "$productSlug" },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, productId: "$_id", productName: 1, productSlug: 1, count: 1 } },
      ]),
      CustomerBehaviorEvent.find(baseMatch)
        .sort({ eventAt: -1 })
        .limit(50)
        .select("customerType customerKey customerName customerEmail eventType pagePath productName nextAction orderId orderValue source medium campaign eventAt")
        .lean(),
      CustomerBehaviorEvent.aggregate([
        { $match: baseMatch },
        {
          $addFields: {
            resolvedCustomerKey: {
              $cond: [
                { $ne: ["$customerKey", ""] },
                "$customerKey",
                {
                  $cond: [
                    { $ne: ["$userId", ""] },
                    { $concat: ["user:", "$userId"] },
                    {
                      $cond: [
                        { $ne: ["$visitorId", ""] },
                        { $concat: ["guest:", "$visitorId"] },
                        {
                          $cond: [
                            { $ne: ["$customerEmail", ""] },
                            { $concat: ["guest_email:", "$customerEmail"] },
                            {
                              $cond: [
                                { $ne: ["$customerPhone", ""] },
                                { $concat: ["guest_phone:", "$customerPhone"] },
                                {
                                  $cond: [
                                    { $ne: ["$sessionId", ""] },
                                    { $concat: ["guest_session:", "$sessionId"] },
                                    "anonymous:unknown",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$resolvedCustomerKey",
            eventCount: { $sum: 1 },
            orderPlacedCount: {
              $sum: {
                $cond: [{ $eq: ["$eventType", "order_placed"] }, 1, 0],
              },
            },
            firstEventAt: { $min: "$eventAt" },
            lastEventAt: { $max: "$eventAt" },
            customerType: { $last: "$customerType" },
            customerName: { $last: "$customerName" },
            customerEmail: { $last: "$customerEmail" },
            customerPhone: { $last: "$customerPhone" },
            customerAddress: { $last: "$customerAddress" },
            userId: { $last: "$userId" },
          },
        },
        { $sort: { lastEventAt: -1, eventCount: -1 } },
        { $limit: 200 },
        {
          $project: {
            _id: 0,
            customerKey: "$_id",
            eventCount: 1,
            orderPlacedCount: 1,
            purchased: { $gt: ["$orderPlacedCount", 0] },
            firstEventAt: 1,
            lastEventAt: 1,
            customerType: 1,
            customerName: 1,
            customerEmail: 1,
            customerPhone: 1,
            customerAddress: 1,
            userId: 1,
          },
        },
      ]),
    ]);

    const uniqueCustomers = customerRows.length;
    const checkoutIntent = eventBreakdown
      .filter((item) => ["add_to_cart", "go_to_checkout", "checkout_visit"].includes(item.eventType))
      .reduce((sum, item) => sum + item.count, 0);
    const totalTrackedDurationMs = pageTimeBreakdown.reduce((sum, item) => sum + Number(item.totalDurationMs || 0), 0);
    const avgPageDurationMs = pageTimeBreakdown.length
      ? Math.round(pageTimeBreakdown.reduce((sum, item) => sum + Number(item.avgDurationMs || 0), 0) / pageTimeBreakdown.length)
      : 0;

    const response = {
      overview: {
        totalEvents,
        uniqueCustomers,
        checkoutIntent,
        conversions: conversionCount,
        totalTrackedDurationMs,
        avgPageDurationMs,
        conversionRate: totalEvents > 0 ? Number(((conversionCount / totalEvents) * 100).toFixed(2)) : 0,
      },
      sourceBreakdown,
      eventBreakdown,
      pageTimeBreakdown,
      actionTimeBreakdown,
      topProducts,
      recentEvents,
      customers: customerRows,
      customerDetail: null,
    };

    if (customerKey) {
      const timeline = await CustomerBehaviorEvent.find({ ...baseMatch, ...buildCustomerFilter(customerKey) })
        .sort({ eventAt: 1 })
        .select("storeId visitorId sessionId userId customerType customerKey customerName customerEmail customerPhone customerAddress eventType pagePath productId productSlug productName durationMs scrollDepthPercent nextAction orderId orderValue source medium campaign referrer eventAt")
        .lean();

      const enrichedTimeline = enrichTimelineWithActionSpent(timeline);
      const actionTimeSpent = buildActionTimeSummary(enrichedTimeline);
      const totalJourneyDurationMs = actionTimeSpent.reduce((sum, item) => sum + Number(item.totalDurationMs || 0), 0);
      const purchased = enrichedTimeline.some((event) => event.eventType === "order_placed");
      const totalOrdersPlaced = enrichedTimeline.filter((event) => event.eventType === "order_placed").length;

      const summary = resolveIdentityFromTimeline(timeline, customerKey);
      response.customerDetail = {
        summary: {
          ...summary,
          purchased,
          totalOrdersPlaced,
        },
        timeline: enrichedTimeline,
        steps: buildJourneySteps(enrichedTimeline),
        actionTimeSpent,
        totalJourneyDurationMs,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Store customer tracking API error:", error);
    return NextResponse.json({ error: error.message || "Failed to load customer tracking" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const storeId = await authSeller(decoded.uid);
    if (!storeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const customerKeys = Array.isArray(body?.customerKeys)
      ? body.customerKeys.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    if (customerKeys.length === 0) {
      return NextResponse.json({ error: "customerKeys is required" }, { status: 400 });
    }

    const result = await CustomerBehaviorEvent.deleteMany({
      storeId,
      $or: customerKeys.map((customerKey) => buildCustomerFilter(customerKey)),
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: `${result.deletedCount || 0} tracking event${result.deletedCount === 1 ? '' : 's'} deleted`,
    });
  } catch (error) {
    console.error("Store customer tracking delete API error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete customer tracking" }, { status: 500 });
  }
}
