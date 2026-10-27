import { z } from "zod";
import { assertSameOrigin } from "@/lib/device-auth";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";

const schema = z.object({
  shiftId: z.string().uuid(),
  actualCash: z.coerce.number().min(0).max(999_999_999_999),
  notes: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const { admin, user, warkopId } = await requireOwner(request);
    const { data: shift, error: shiftError } = await admin
      .from("shifts")
      .select("id,opened_by,status")
      .eq("id", input.shiftId)
      .eq("warkop_id", warkopId)
      .maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift || shift.status !== "OPEN" || !shift.opened_by) throw new OwnerApiError("Shift kasir tidak aktif.", 409);

    const { data, error } = await admin.rpc("end_cashier_shift", {
      p_shift_id: shift.id,
      p_member_id: shift.opened_by,
      p_actual_cash_deposited: input.actualCash,
      p_notes: input.notes || "Ditutup oleh Owner.",
    });
    if (error) throw new OwnerApiError(error.message, 409);
    await admin.from("audit_logs").insert({
      warkop_id: warkopId,
      actor_user_id: user.id,
      action: "OWNER_CLOSED_CASHIER_SHIFT",
      target_type: "shift",
      target_id: shift.id,
    });
    return Response.json({ result: data });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data penutupan shift tidak valid." }, { status: 400 });
    return ownerErrorResponse(error);
  }
}

