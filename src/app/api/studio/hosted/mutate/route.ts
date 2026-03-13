import { NextResponse } from "next/server";
import type { HostedStudioMutation } from "@/features/studio/studio-hosted-mock-api";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { mutateHostedState } from "@/server/studio/hosted-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const mutation = (await request.json()) as HostedStudioMutation;
    const response = NextResponse.json(
      await mutateHostedState({
        supabase,
        user,
        mutation,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Hosted workspace mutation failed.",
      },
      { status: 400 }
    );
  }
}
