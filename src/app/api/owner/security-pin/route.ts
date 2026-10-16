import { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/device-auth";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN harus terdiri dari 4 hingga 6 digit angka."),
  enabled: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const { data: member, error } = await admin
      .from("warkop_members")
      .select("display_name")
      .eq("warkop_id", warkopId)
      .eq("role", "OWNER")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const hasPin = Boolean(member?.display_name && member.display_name.startsWith("AUDIT_PIN:"));
    return Response.json({
      hasPin,
      enabled: hasPin,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const body = await request.json();

    // Jika ingin menonaktifkan PIN
    if (body.action === "disable") {
      const { data: members, error: findError } = await admin
        .from("warkop_members")
        .select("id")
        .eq("warkop_id", warkopId)
        .eq("role", "OWNER");
      if (findError) throw findError;

      for (const m of members || []) {
        await admin
          .from("warkop_members")
          .update({ display_name: null })
          .eq("id", m.id);
      }

      await admin.from("audit_logs").insert({
        warkop_id: warkopId,
        actor_user_id: user.id,
        action: "OWNER_AUDIT_PIN_DISABLED",
        target_type: "warkop",
        target_id: warkopId,
        metadata: { disabled_at: new Date().toISOString() },
      });

      return Response.json({ success: true, message: "PIN audit berhasil dinonaktifkan." });
    }

    const { pin } = pinSchema.parse(body);

    // Dapatkan baris OWNER dari warkop ini
    const { data: member, error: findError } = await admin
      .from("warkop_members")
      .select("id")
      .eq("warkop_id", warkopId)
      .eq("role", "OWNER")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (!member) throw new OwnerApiError("Data profil owner tidak ditemukan.", 404);

    // Simpan pin dengan format terstandarisasi AUDIT_PIN:pin
    const pinPayload = `AUDIT_PIN:${pin}`;
    const { error: updateError } = await admin
      .from("warkop_members")
      .update({ display_name: pinPayload })
      .eq("id", member.id);
    if (updateError) throw updateError;

    await admin.from("audit_logs").insert({
      warkop_id: warkopId,
      actor_user_id: user.id,
      action: "OWNER_AUDIT_PIN_SET",
      target_type: "warkop",
      target_id: warkopId,
      metadata: { set_at: new Date().toISOString(), length: pin.length },
    });

    return Response.json({ success: true, message: "PIN audit berhasil disimpan." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "PIN tidak valid." }, { status: 400 });
    }
    return ownerErrorResponse(error);
  }
}
