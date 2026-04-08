import { NextResponse } from 'next/server';

function resolveUpstreamBase() {
  const configuredBase = String(process.env.GEOHAUL_BASE_URL || '').trim();
  const explicitUpstream = String(process.env.GEOHAUL_UPSTREAM_BASE_URL || '').trim();

  if (explicitUpstream) return explicitUpstream.replace(/\/$/, '');

  // Avoid proxy loops when local base is used for app routes.
  if (!configuredBase || configuredBase.includes('localhost') || configuredBase.includes('127.0.0.1')) {
    return 'https://sb.backend.geohaulexpress.com';
  }

  return configuredBase.replace(/\/$/, '');
}

function buildAuthHeader() {
  const apiKey = String(process.env.GEOHAUL_API_KEY || '').trim();
  const apiSecret = String(process.env.GEOHAUL_API_SECRET || '').trim();

  if (!apiKey || !apiSecret) {
    throw new Error('GeoHaul credentials are missing. Set GEOHAUL_API_KEY and GEOHAUL_API_SECRET.');
  }

  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return `Basic ${token}`;
}

async function proxyRequest(request, context, method) {
  try {
    const upstreamBase = resolveUpstreamBase();
    const params = await context?.params;
    const slug = Array.isArray(params?.slug) ? params.slug.join('/') : '';
    const incomingUrl = new URL(request.url);
    const queryString = incomingUrl.search || '';
    const upstreamUrl = `${upstreamBase}/api/v2/consignment/${slug}${queryString}`;

    const headers = {
      Accept: 'application/json',
      Authorization: buildAuthHeader(),
    };

    let body;
    if (method !== 'GET' && method !== 'HEAD') {
      const rawBody = await request.text();
      body = rawBody;
      headers['Content-Type'] = request.headers.get('content-type') || 'application/json';
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    const raw = await upstreamResponse.text();

    // Preserve JSON responses when possible.
    try {
      const json = raw ? JSON.parse(raw) : {};
      return NextResponse.json(json, { status: upstreamResponse.status });
    } catch {
      return new NextResponse(raw, {
        status: upstreamResponse.status,
        headers: { 'content-type': upstreamResponse.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'GeoHaul proxy failed' },
      { status: 500 }
    );
  }
}

export async function GET(request, context) {
  return proxyRequest(request, context, 'GET');
}

export async function POST(request, context) {
  return proxyRequest(request, context, 'POST');
}

export async function PUT(request, context) {
  return proxyRequest(request, context, 'PUT');
}
