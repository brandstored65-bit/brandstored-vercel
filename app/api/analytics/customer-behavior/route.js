export const dynamic = 'force-dynamic'

import connectDB from "@/lib/mongodb";
import { NextResponse } from "next/server";
import CustomerBehaviorEvent from "@/models/CustomerBehaviorEvent";
import User from "@/models/User";
import Address from "@/models/Address";

const ALLOWED_EVENTS = new Set([
  "product_view",
  "product_exit",
  "add_to_cart",
  "go_to_checkout",
  "order_placed",
  "page_view",
  "checkout_visit",
]);

const normalizeString = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeString(value).toLowerCase();

function resolveIdentity(payload) {
  const userId = normalizeString(payload.userId);
  const visitorId = normalizeString(payload.visitorId);
  const sessionId = normalizeString(payload.sessionId);
  const customerEmail = normalizeLower(payload.customerEmail);
  const customerPhone = normalizeString(payload.customerPhone).replace(/\s+/g, "");

  if (userId) {
    return { customerType: "logged_in", customerKey: `user:${userId}` };
  }
  if (visitorId) {
    return { customerType: "guest", customerKey: `guest:${visitorId}` };
  }
  if (customerEmail) {
    return { customerType: "guest", customerKey: `guest_email:${customerEmail}` };
  }
  if (customerPhone) {
    return { customerType: "guest", customerKey: `guest_phone:${customerPhone}` };
  }
  if (sessionId) {
    return { customerType: "anonymous", customerKey: `guest_session:${sessionId}` };
  }

  return { customerType: "anonymous", customerKey: "" };
}

async function findIdentityFallback({ storeId, userId, visitorId, sessionId, customerEmail, customerPhone }) {
  const fallbackOr = [];
  if (userId) fallbackOr.push({ userId });
  if (visitorId) fallbackOr.push({ visitorId });
  if (sessionId) fallbackOr.push({ sessionId });
  if (customerEmail) fallbackOr.push({ customerEmail: normalizeLower(customerEmail) });
  if (customerPhone) fallbackOr.push({ customerPhone: normalizeString(customerPhone).replace(/\s+/g, "") });

  if (fallbackOr.length === 0) return null;

  return CustomerBehaviorEvent.findOne({
    storeId,
    $or: fallbackOr,
  }).sort({ eventAt: -1 }).lean();
}

async function resolveUserProfileFallback(userId) {
  if (!userId) return null;
  const user = await User.findById(userId).select("name email phone").lean();
  if (!user) return null;

  let addressText = "";
  const address = await Address.findOne({ userId }).sort({ updatedAt: -1 }).lean();
  if (address) {
    addressText = [address.street, address.city || address.district, address.state, address.country, address.zip]
      .filter(Boolean)
      .join(", ");
  }

  return {
    customerName: normalizeString(user.name),
    customerEmail: normalizeLower(user.email),
    customerPhone: normalizeString(user.phone).replace(/\s+/g, ""),
    customerAddress: addressText,
  };
}

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const storeId = normalizeString(body.storeId);
    const eventType = normalizeString(body.eventType);

    if (!storeId) {
      return NextResponse.json({ error: "storeId is required" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const identityFromPayload = {
      userId: normalizeString(body.userId),
      visitorId: normalizeString(body.visitorId),
      sessionId: normalizeString(body.sessionId),
      customerName: normalizeString(body.customerName),
      customerEmail: normalizeLower(body.customerEmail),
      customerPhone: normalizeString(body.customerPhone).replace(/\s+/g, ""),
      customerAddress: normalizeString(body.customerAddress),
      customerType: normalizeString(body.customerType),
      customerKey: normalizeString(body.customerKey),
    };

    const historical = await findIdentityFallback({
      storeId,
      userId: identityFromPayload.userId,
      visitorId: identityFromPayload.visitorId,
      sessionId: identityFromPayload.sessionId,
      customerEmail: identityFromPayload.customerEmail,
      customerPhone: identityFromPayload.customerPhone,
    });

    const userProfile = await resolveUserProfileFallback(identityFromPayload.userId || historical?.userId);

    const mergedIdentity = {
      userId: identityFromPayload.userId || historical?.userId || "",
      visitorId: identityFromPayload.visitorId || historical?.visitorId || "",
      sessionId: identityFromPayload.sessionId || historical?.sessionId || "",
      customerName: identityFromPayload.customerName || historical?.customerName || userProfile?.customerName || "",
      customerEmail: identityFromPayload.customerEmail || historical?.customerEmail || userProfile?.customerEmail || "",
      customerPhone: identityFromPayload.customerPhone || historical?.customerPhone || userProfile?.customerPhone || "",
      customerAddress: identityFromPayload.customerAddress || historical?.customerAddress || userProfile?.customerAddress || "",
    };

    const resolvedIdentity = resolveIdentity({
      ...mergedIdentity,
      customerEmail: mergedIdentity.customerEmail,
      customerPhone: mergedIdentity.customerPhone,
    });

    const doc = await CustomerBehaviorEvent.create({
      storeId,
      ...mergedIdentity,
      customerType: identityFromPayload.customerType || resolvedIdentity.customerType,
      customerKey: identityFromPayload.customerKey || resolvedIdentity.customerKey,

      eventType,
      source: normalizeString(body.source) || "direct",
      medium: normalizeString(body.medium) || "direct",
      campaign: normalizeString(body.campaign) || "none",
      referrer: normalizeString(body.referrer),
      pagePath: normalizeString(body.pagePath),

      productId: normalizeString(body.productId),
      productSlug: normalizeString(body.productSlug),
      productName: normalizeString(body.productName),

      durationMs: Number(body.durationMs) || 0,
      scrollDepthPercent: Number(body.scrollDepthPercent) || 0,
      nextAction: normalizeString(body.nextAction),

      orderId: normalizeString(body.orderId),
      orderValue: Number(body.orderValue) || 0,
      eventAt: body.eventAt ? new Date(body.eventAt) : new Date(),
    });

    return NextResponse.json({ success: true, id: doc._id });
  } catch (error) {
    console.error("Customer behavior ingest error:", error);
    return NextResponse.json({ error: error.message || "Failed to ingest event" }, { status: 500 });
  }
}
