import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { deleteHostedAccount } from "@/server/studio/hosted-store";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    await deleteHostedAccount({
      supabase,
      user,
    });
    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Could not delete hosted account.");
  }
}
