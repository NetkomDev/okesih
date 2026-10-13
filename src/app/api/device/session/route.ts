import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clearDeviceCookie, deviceErrorResponse } from "@/lib/device-auth";

const schema = z.object({ deviceType: z.enum(["POS", "KDS"]) });

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { deviceType } = schema.parse(await request.json());
    const response = NextResponse.json({ success: true });
    clearDeviceCookie(response, deviceType);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Tipe perangkat tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}

