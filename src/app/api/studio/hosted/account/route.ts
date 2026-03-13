import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { deleteHostedAccount } from "@/server/studio/hosted-store";

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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete hosted account.",
      },
      { status: 400 }
    );
  }
}
