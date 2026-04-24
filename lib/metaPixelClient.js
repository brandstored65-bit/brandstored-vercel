"use client";

export const getAttributionData = () => {
  if (typeof window === 'undefined') return {};
  return window.attributionData || {};
};

export const normalizeMetaError = (error) => {
  if (!error) return 'Unknown Meta Pixel error';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    return error.message || error.error || error.detail || JSON.stringify(error);
  }
  return String(error);
};

export const trackMetaEvent = (eventName, params = {}, options = {}) => {
  if (typeof window === 'undefined' || !window.fbq || !eventName) return false;

  try {
    const payload = {
      ...params,
      ...getAttributionData(),
    };

    // Deduplicate by eventID or order id when available (prevents double firing)
    const dedupeId = options?.eventID || payload.eventID || payload.event_id || payload.order_id || payload.orderId || null;
    if (dedupeId) {
      try {
        const key = `meta_event_sent_${eventName}_${String(dedupeId)}`;
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) {
          return false;
        }
        // Mark as sent immediately to avoid races
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
      } catch (err) {
        // ignore sessionStorage errors
      }
    }

    if (options?.eventID) {
      window.fbq('track', eventName, payload, { eventID: options.eventID });
    } else {
      window.fbq('track', eventName, payload);
    }

    return true;
  } catch (error) {
    console.warn('[MetaPixel] track error:', normalizeMetaError(error));
    return false;
  }
};
