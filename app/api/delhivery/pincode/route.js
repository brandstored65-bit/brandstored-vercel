export const dynamic = 'force-dynamic'

import { checkPincodeServiceability } from "@/lib/delhivery";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pincode = searchParams.get("pincode");
  if (!pincode) return Response.json({ error: "Missing pincode" }, { status: 400 });
  try {
    const result = await checkPincodeServiceability(pincode);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
