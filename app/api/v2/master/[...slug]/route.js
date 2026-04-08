import { NextResponse } from 'next/server';

function resolveUpstreamBase() {
  const configuredBase = String(process.env.GEOHAUL_BASE_URL || '').trim();
  const explicitUpstream = String(process.env.GEOHAUL_UPSTREAM_BASE_URL || '').trim();

  if (explicitUpstream) return explicitUpstream.replace(/\/$/, '');

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
  return {
    Authorization: `Basic ${token}`,
    'x-api-key': apiKey,
    'x-api-secret': apiSecret,
    'api-key': apiKey,
    'api-secret': apiSecret,
  };
}

export async function GET(request, context) {
  try {
    const upstreamBase = resolveUpstreamBase();
    const params = await context?.params;
    const slug = Array.isArray(params?.slug) ? params.slug.join('/') : '';
    const incomingUrl = new URL(request.url);
    const upstreamUrl = `${upstreamBase}/api/v2/master/${slug}${incomingUrl.search || ''}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...buildAuthHeader(),
      },
      cache: 'no-store',
    });

    const raw = await upstreamResponse.text();

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
      { error: error?.message || 'GeoHaul master proxy failed' },
      { status: 500 }
    );
  }
}
