export function normalizeCourierName(courier = '') {
  return String(courier || '').trim().toLowerCase();
}

export function getDefaultTrackingUrl(courier, trackingId) {
  const normalizedCourier = normalizeCourierName(courier);
  const normalizedTrackingId = String(trackingId || '').trim();

  if (!normalizedTrackingId) return '';

  if (normalizedCourier.includes('tawseel')) {
    return `https://courier.tawseel.com/track.php?trackno=${encodeURIComponent(normalizedTrackingId)}`;
  }

  if (normalizedCourier.includes('geoh') || normalizedCourier.includes('geohaul')) {
    const template = String(
      process.env.NEXT_PUBLIC_GEOHAUL_TRACKING_URL_TEMPLATE ||
      'https://courier.tawseel.com/track.php?trackno={awb}'
    ).trim();

    if (template.includes('{awb}')) {
      return template.replace('{awb}', encodeURIComponent(normalizedTrackingId));
    }

    const separator = template.endsWith('/') ? '' : '/';
    return `${template}${separator}${encodeURIComponent(normalizedTrackingId)}`;
  }

  if (normalizedCourier.includes('delhivery') || !normalizedCourier) {
    return `https://www.delhivery.com/track-v2/package/${encodeURIComponent(normalizedTrackingId)}`;
  }

  return '';
}

export function isTawseelTracking(courier, trackingUrl = '') {
  const normalizedCourier = normalizeCourierName(courier);
  const normalizedUrl = String(trackingUrl || '').toLowerCase();

  return normalizedCourier.includes('tawseel') || normalizedUrl.includes('courier.tawseel.com');
}

export function isDelhiveryTracking(courier, trackingUrl = '') {
  const normalizedCourier = normalizeCourierName(courier);
  const normalizedUrl = String(trackingUrl || '').toLowerCase();

  return normalizedCourier.includes('delhivery') || (!normalizedUrl && !normalizedCourier) || normalizedUrl.includes('delhivery.com');
}

export function mapTrackingStatusToOrderStatus(tracking, currentStatus) {
  if (!tracking) return null;

  const texts = [];

  if (tracking.current_status) {
    texts.push(String(tracking.current_status).toLowerCase());
  }

  if (Array.isArray(tracking.events) && tracking.events.length > 0) {
    tracking.events.forEach((event) => {
      if (event?.status) texts.push(String(event.status).toLowerCase());
      if (event?.remarks) texts.push(String(event.remarks).toLowerCase());
    });
  }

  if (texts.length === 0) return null;

  const combined = texts.join(' | ');

  if (combined.includes('delivered')) return 'DELIVERED';
  if (combined.includes('out for delivery')) return 'OUT_FOR_DELIVERY';
  if (combined.includes('picked up') || combined.includes('picked-up') || combined.includes('picked')) return 'PICKED_UP';
  if (combined.includes('pickup requested')) return 'PICKUP_REQUESTED';
  if (combined.includes('waiting for pickup')) return 'WAITING_FOR_PICKUP';
  if (combined.includes('warehouse') || combined.includes('hub') || combined.includes('sorting')) return 'WAREHOUSE_RECEIVED';

  if (combined.includes('under process') || combined.includes('processing') || combined.includes('pending')) {
    if (currentStatus === 'ORDER_PLACED') return 'PROCESSING';
    return currentStatus || 'PROCESSING';
  }

  if (
    combined.includes('in transit') ||
    combined.includes('dispatched') ||
    combined.includes('shipped') ||
    combined.includes('forwarded')
  ) {
    if (
      currentStatus === 'ORDER_PLACED' ||
      currentStatus === 'PROCESSING' ||
      currentStatus === 'WAITING_FOR_PICKUP' ||
      currentStatus === 'PICKUP_REQUESTED' ||
      currentStatus === 'PICKED_UP' ||
      currentStatus === 'WAREHOUSE_RECEIVED'
    ) {
      return 'SHIPPED';
    }
  }

  return null;
}