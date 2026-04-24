export const dynamic = 'force-dynamic'

import { getExpectedTAT } from "@/lib/delhivery";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const mot = searchParams.get("mot") || "S";
  const pdt = searchParams.get("pdt") || "B2C";
  const expected_pickup_date = searchParams.get("expected_pickup_date") || "";
  if (!origin || !destination) return Response.json({ error: "Missing origin or destination" }, { status: 400 });
  try {
    const result = await getExpectedTAT(origin, destination, mot, pdt, expected_pickup_date);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
