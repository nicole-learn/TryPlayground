import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { getHostedSyncPayload } from "@/server/studio/hosted-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const url = new URL(request.url);
    const rawSinceRevision = url.searchParams.get("sinceRevision");
    const sinceRevision =
      rawSinceRevision && rawSinceRevision.trim().length > 0
        ? Number.parseInt(rawSinceRevision, 10)
        : null;

    const response = NextResponse.json(
      await getHostedSyncPayload({
        supabase,
        user,
        sinceRevision:
          typeof sinceRevision === "number" && Number.isFinite(sinceRevision)
            ? sinceRevision
            : null,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not sync hosted workspace.",
      },
      { status: 401 }
    );
  }
}
