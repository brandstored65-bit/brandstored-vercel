"use client";

const VISITOR_ID_KEY = "qf_visitor_id";
const SESSION_ID_KEY = "qf_session_id";
const TRACKING_STORE_ID_KEY = "qf_tracking_store_id";
const LAST_IDENTITY_KEY = "qf_last_customer_identity";

const EVENT_TYPES = new Set([
  "product_view",
  "product_exit",
  "add_to_cart",
  "go_to_checkout",
  "order_placed",
  "page_view",
  "checkout_visit",
]);

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function safeStorage(getter) {
  if (typeof window === "undefined") return null;
  try {
    return getter();
  } catch {
    return null;
  }
}

export function getVisitorId() {
  if (typeof window === "undefined") return "";
  let id = safeStorage(() => localStorage.getItem(VISITOR_ID_KEY));
  if (!id) {
    id = randomId("v");
    safeStorage(() => localStorage.setItem(VISITOR_ID_KEY, id));
  }
  return id;
}

export function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = safeStorage(() => sessionStorage.getItem(SESSION_ID_KEY));
  if (!id) {
    id = randomId("s");
    safeStorage(() => sessionStorage.setItem(SESSION_ID_KEY, id));
  }
  return id;
}

export function setTrackingStoreId(storeId) {
  if (!storeId || typeof window === "undefined") return;
  safeStorage(() => localStorage.setItem(TRACKING_STORE_ID_KEY, String(storeId)));
}

export function getTrackingStoreId() {
  if (typeof window === "undefined") return "";
  return safeStorage(() => localStorage.getItem(TRACKING_STORE_ID_KEY)) || "";
}

export function saveIdentitySnapshot(identity) {
  if (typeof window === "undefined") return;
  safeStorage(() => localStorage.setItem(LAST_IDENTITY_KEY, JSON.stringify(identity || {})));
}

function getIdentitySnapshot() {
  if (typeof window === "undefined") return {};
  const raw = safeStorage(() => localStorage.getItem(LAST_IDENTITY_KEY));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\s+/g, "").trim();
}

export function resolveCustomerIdentity({ user, identity } = {}) {
  const fallback = getIdentitySnapshot();

  const userId = user?.uid || identity?.userId || fallback?.userId || "";
  const customerEmail = (identity?.customerEmail || identity?.email || user?.email || fallback?.customerEmail || "").trim();
  const customerPhone = normalizePhone(identity?.customerPhone || identity?.phone || user?.phoneNumber || fallback?.customerPhone || "");
  const customerName = (identity?.customerName || identity?.name || user?.displayName || fallback?.customerName || "").trim();
  const customerAddress = (identity?.customerAddress || identity?.address || fallback?.customerAddress || "").trim();

  const visitorId = identity?.visitorId || getVisitorId();
  const sessionId = identity?.sessionId || getSessionId();

  let customerType = "anonymous";
  let customerKey = "";

  if (userId) {
    customerType = "logged_in";
    customerKey = `user:${userId}`;
  } else if (visitorId) {
    customerType = "guest";
    customerKey = `guest:${visitorId}`;
  } else if (customerEmail) {
    customerType = "guest";
    customerKey = `guest_email:${customerEmail.toLowerCase()}`;
  } else if (customerPhone) {
    customerType = "guest";
    customerKey = `guest_phone:${customerPhone}`;
  } else if (sessionId) {
    customerType = "anonymous";
    customerKey = `guest_session:${sessionId}`;
  }

  const resolved = {
    userId,
    visitorId,
    sessionId,
    customerType,
    customerKey,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
  };

  saveIdentitySnapshot(resolved);
  return resolved;
}

function getAttribution() {
  if (typeof window === "undefined") {
    return { source: "direct", medium: "direct", campaign: "none", referrer: "" };
  }

  let utm = {};
  const raw = safeStorage(() => localStorage.getItem("utm_data"));
  if (raw) {
    try {
      utm = JSON.parse(raw);
    } catch {
      utm = {};
    }
  }

  return {
    source: utm.source || "direct",
    medium: utm.medium || "direct",
    campaign: utm.campaign || "none",
    referrer: utm.referrer || document.referrer || "",
  };
}

export async function trackCustomerBehavior(payload = {}, options = {}) {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };

  const eventType = payload?.eventType;
  if (!EVENT_TYPES.has(eventType)) return { ok: false, reason: "invalid_event" };

  const resolvedStoreId = String(payload.storeId || getTrackingStoreId() || "").trim();
  if (!resolvedStoreId) return { ok: false, reason: "missing_store" };

  const identity = resolveCustomerIdentity({ user: options.user, identity: options.identity || payload.identity });
  const attribution = getAttribution();

  const body = {
    ...payload,
    storeId: resolvedStoreId,
    ...identity,
    ...attribution,
    pagePath: payload.pagePath || `${window.location.pathname}${window.location.search || ""}`,
    eventAt: payload.eventAt || new Date().toISOString(),
  };

  try {
    const res = await fetch("/api/analytics/customer-behavior", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: payload.eventType === "product_exit",
    });

    return { ok: res.ok };
  } catch {
    return { ok: false, reason: "network" };
  }
}
