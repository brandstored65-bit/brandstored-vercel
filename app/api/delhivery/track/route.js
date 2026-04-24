export const dynamic = 'force-dynamic'

import axios from "axios";

const DELHIVERY_API_TOKEN = process.env.DELHIVERY_API_TOKEN;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const waybill = searchParams.get("waybill");
  const ref_ids = searchParams.get("ref_ids") || "";
  if (!waybill) return Response.json({ error: "Missing waybill" }, { status: 400 });

  const url = `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybill}&ref_ids=${ref_ids}`;
  const headers = {
    Authorization: `Token ${DELHIVERY_API_TOKEN}`,
    "Content-Type": "application/json"
  };

  try {
    const { data } = await axios.get(url, { headers });
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
