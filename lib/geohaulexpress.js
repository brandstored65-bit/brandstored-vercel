function resolveGeoHaulBaseUrl() {
  const configuredBase = String(process.env.GEOHAUL_BASE_URL || '').trim();
  const explicitUpstream = String(process.env.GEOHAUL_UPSTREAM_BASE_URL || '').trim();

  if (explicitUpstream) return explicitUpstream.replace(/\/$/, '');

  if (!configuredBase || configuredBase.includes('localhost') || configuredBase.includes('127.0.0.1')) {
    return 'https://sb.backend.geohaulexpress.com';
  }

  return configuredBase.replace(/\/$/, '');
}

function toBasicAuth(username, password) {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

function getGeoHaulAuthHeader() {
  const apiKey = String(process.env.GEOHAUL_API_KEY || '').trim();
  const apiSecret = String(process.env.GEOHAUL_API_SECRET || '').trim();
  const basicUsername = String(process.env.GEOHAUL_BASIC_USERNAME || '').trim();
  const basicPassword = String(process.env.GEOHAUL_BASIC_PASSWORD || '').trim();
  const bearerToken = String(process.env.GEOHAUL_BEARER_TOKEN || '').trim();

  if (apiKey && apiSecret) {
    return `Basic ${toBasicAuth(apiKey, apiSecret)}`;
  }

  if (basicUsername && basicPassword) {
    return `Basic ${toBasicAuth(basicUsername, basicPassword)}`;
  }

  if (bearerToken) {
    return `Bearer ${bearerToken}`;
  }

  throw new Error('GeoHaul credentials are missing. Set GEOHAUL_API_KEY and GEOHAUL_API_SECRET.');
}

function sanitizePhoneCode(input, fallback = '971') {
  const value = String(input || '').replace(/\D/g, '');
  return value || fallback;
}

function sanitizePhoneNumber(input) {
  return String(input || '').replace(/\D/g, '');
}

function numberOr(input, fallback) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeDeep(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  const output = { ...target };
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeDeep(output[key], sourceValue);
    } else {
      output[key] = sourceValue;
    }
  });
  return output;
}

async function geoHaulRequest(path, payload, method = 'POST') {
  const url = `${resolveGeoHaulBaseUrl()}${path}`;
  const isGetLike = method === 'GET' || method === 'HEAD';
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: getGeoHaulAuthHeader(),
      ...(isGetLike ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(isGetLike ? {} : { body: JSON.stringify(payload || {}) }),
    cache: 'no-store',
  });

  const rawText = await response.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    const message = data?.response?.message || data?.message || `GeoHaul request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return data;
}

export function buildGeoHaulConsignmentPayloadFromOrder(order, overrides = {}) {
  const shipping = order?.shippingAddress || {};
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];

  const payload = {
    customerReferenceNumber: String(order?.shortOrderNumber || order?._id || '').trim(),
    serviceType: String(process.env.GEOHAUL_SERVICE_TYPE || 'AJEX ICX').trim(),
    courierType: String(process.env.GEOHAUL_COURIER_TYPE || 'NON-DOCUMENT').trim(),
    currency: String(process.env.GEOHAUL_CURRENCY || 'USD').trim(),
    numberOfPieces: Math.max(1, items.length || 1),
    description: String(items.map((item) => item?.name || '').filter(Boolean).join(', ') || 'Order shipment').slice(0, 250),
    notes: String(overrides?.notes || order?.notes || 'Generated from store order').slice(0, 300),
    paymentType: String(order?.paymentMethod || '').toUpperCase() === 'COD' ? 'COD' : 'PREPAID',
    cod: String(order?.paymentMethod || '').toUpperCase() === 'COD' ? numberOr(order?.total, 0) : 0,
    consignorInfo: {
      name: String(process.env.GEOHAUL_CONSIGNOR_NAME || '').trim(),
      phone: {
        countryCode: sanitizePhoneCode(process.env.GEOHAUL_CONSIGNOR_PHONE_CODE, '971'),
        number: sanitizePhoneNumber(process.env.GEOHAUL_CONSIGNOR_PHONE || ''),
      },
      country: String(process.env.GEOHAUL_CONSIGNOR_COUNTRY || 'United Arab Emirates').trim(),
      city: String(process.env.GEOHAUL_CONSIGNOR_CITY || '').trim(),
      state: String(process.env.GEOHAUL_CONSIGNOR_STATE || '').trim(),
      addressLine1: String(process.env.GEOHAUL_CONSIGNOR_ADDRESS1 || '').trim(),
      addressLine2: String(process.env.GEOHAUL_CONSIGNOR_ADDRESS2 || '').trim(),
      street: String(process.env.GEOHAUL_CONSIGNOR_STREET || '').trim(),
      flatVilla: String(process.env.GEOHAUL_CONSIGNOR_FLAT_VILLA || '').trim(),
      shortCode: String(process.env.GEOHAUL_CONSIGNOR_SHORT_CODE || 'AJEX').trim(),
      isAddressBook: false,
    },
    consigneeInfo: {
      name: String(shipping?.name || order?.customerName || order?.guestName || 'Customer').trim(),
      phone: {
        countryCode: sanitizePhoneCode(shipping?.phoneCode, '971'),
        number: sanitizePhoneNumber(shipping?.phone || order?.guestPhone || ''),
      },
      country: String(shipping?.country || 'United Arab Emirates').trim(),
      city: String(shipping?.city || '').trim(),
      state: String(shipping?.state || shipping?.city || '').trim(),
      addressLine1: String(shipping?.street || '').trim(),
      addressLine2: String(shipping?.district || '').trim(),
      street: String(shipping?.street || '').trim(),
      flatVilla: String(shipping?.landmark || '').trim(),
      shortCode: String(process.env.GEOHAUL_CONSIGNEE_SHORT_CODE || 'AJEX').trim(),
      isAddressBook: false,
    },
    declaredValue: {
      length: numberOr(process.env.GEOHAUL_PACKAGE_LENGTH_CM, 10),
      width: numberOr(process.env.GEOHAUL_PACKAGE_WIDTH_CM, 10),
      height: numberOr(process.env.GEOHAUL_PACKAGE_HEIGHT_CM, 10),
      dimensionUnit: String(process.env.GEOHAUL_DIMENSION_UNIT || 'CM').trim(),
      weight: numberOr(process.env.GEOHAUL_PACKAGE_WEIGHT_KG, 1),
      weightUnit: String(process.env.GEOHAUL_WEIGHT_UNIT || 'KG').trim(),
      itemValue: numberOr(order?.total, 0),
    },
  };

  return mergeDeep(payload, overrides || {});
}

export function getGeoHaulTrackingUrl(awb) {
  const trackingId = String(awb || '').trim();
  if (!trackingId) return '';

  const template = String(
    process.env.GEOHAUL_TRACKING_URL_TEMPLATE || 'https://courier.tawseel.com/track.php?trackno={awb}'
  ).trim();
  if (template.includes('{awb}')) {
    return template.replace('{awb}', encodeURIComponent(trackingId));
  }

  if (!template) return '';

  const separator = template.endsWith('/') ? '' : '/';
  return `${template}${separator}${encodeURIComponent(trackingId)}`;
}

export async function createGeoHaulConsignment(payload) {
  return geoHaulRequest('/api/v2/consignment/create', payload, 'POST');
}

export async function updateGeoHaulConsignment(payload) {
  return geoHaulRequest('/api/v2/consignment/update', payload, 'PUT');
}

export async function cancelGeoHaulConsignment(payload) {
  return geoHaulRequest('/api/v2/consignment/cancel', payload, 'PUT');
}