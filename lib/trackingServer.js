import { fetchNormalizedDelhiveryTracking } from '@/lib/delhivery';
import {
  getDefaultTrackingUrl,
  isDelhiveryTracking,
  isTawseelTracking,
} from '@/lib/trackingShared';

const TAWSEEL_STATUS_ROW_REGEX = /<tr[^>]*>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<\/tr>/gi;

function parseTawseelDate(value) {
  const input = String(value || '').trim();
  const match = input.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return input;

  const [, day, monthLabel, year, hour, minute] = match;
  const monthMap = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };
  const month = monthMap[monthLabel];

  if (!month) return input;

  return `${year}-${month}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:00`;
}

async function fetchTawseelTracking(trackingId) {
  const resolvedUrl = getDefaultTrackingUrl('Tawseel', trackingId);
  const response = await fetch(resolvedUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Tawseel tracking failed with status ${response.status}`);
  }

  const html = await response.text();
  const events = [];

  for (const match of html.matchAll(TAWSEEL_STATUS_ROW_REGEX)) {
    const status = String(match[1] || '').replace(/\s+/g, ' ').trim();
    const timeLabel = String(match[2] || '').replace(/\s+/g, ' ').trim();

    if (!status || !timeLabel) continue;

    events.push({
      status,
      time: parseTawseelDate(timeLabel),
      location: '',
      remarks: ''
    });
  }

  if (!events.length) {
    throw new Error('No Tawseel tracking events found');
  }

  const sortedEvents = [...events].sort((left, right) => new Date(right.time) - new Date(left.time));
  const latest = sortedEvents[0];

  return {
    courier: 'Tawseel',
    trackingId,
    trackingUrl: resolvedUrl,
    delhivery: {
      waybill: trackingId,
      current_status: latest.status,
      current_status_time: latest.time,
      current_status_location: '',
      current_status_remarks: '',
      expected_delivery_date: null,
      origin: '',
      destination: '',
      events: sortedEvents,
      payment: {
        is_cod_recovered: false,
        cod_amount: 0,
        payment_method: '',
        payment_status: '',
        payment_collected_at: null,
      }
    }
  };
}

async function tryTrackingResolver(resolver) {
  try {
    return await resolver();
  } catch {
    return null;
  }
}

export async function fetchNormalizedTracking({ trackingId, courier, trackingUrl }) {
  const normalizedTrackingId = String(trackingId || '').trim();
  if (!normalizedTrackingId) return null;

  if (isTawseelTracking(courier, trackingUrl)) {
    return fetchTawseelTracking(normalizedTrackingId);
  }

  if (isDelhiveryTracking(courier, trackingUrl)) {
    const delhiveryResult = await tryTrackingResolver(() => fetchNormalizedDelhiveryTracking(normalizedTrackingId));
    if (delhiveryResult) {
      return delhiveryResult;
    }

    if (!courier && !trackingUrl) {
      const tawseelResult = await tryTrackingResolver(() => fetchTawseelTracking(normalizedTrackingId));
      if (tawseelResult) {
        return tawseelResult;
      }
    }

    return null;
  }

  if (!courier && !trackingUrl) {
    const tawseelResult = await tryTrackingResolver(() => fetchTawseelTracking(normalizedTrackingId));
    if (tawseelResult) {
      return tawseelResult;
    }

    const delhiveryResult = await tryTrackingResolver(() => fetchNormalizedDelhiveryTracking(normalizedTrackingId));
    if (delhiveryResult) {
      return delhiveryResult;
    }
  }

  return null;
}