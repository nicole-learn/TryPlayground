import { NextResponse } from "next/server";
import type { HostedStudioMutation } from "@/features/studio/studio-hosted-api";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { mutateHostedState } from "@/server/studio/hosted-store";
import { parseHostedMutationPayload } from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const mutation: HostedStudioMutation =
      parseHostedMutationPayload(await request.json());
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
    return toStudioErrorResponse(error, "Hosted workspace mutation failed.");
  }
}
