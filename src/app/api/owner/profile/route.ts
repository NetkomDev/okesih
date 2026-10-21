import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";
export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request, { allowOnboarding: true });
    const { data, error } = await admin.from("warkops").select("id,nama,slug,address,is_active,logo_url,qris_image_url,qris_merchant_name").eq("id", warkopId).single();
    if (error) throw error;
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ownerErrorResponse(error); }
}
