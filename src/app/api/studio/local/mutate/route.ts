import { NextResponse } from "next/server";
import { getLocalProviderKeysFromRequest } from "@/server/fal/studio-fal";
import type { LocalStudioMutation } from "@/features/studio/studio-local-api";
import { mutateLocalSnapshot } from "@/server/local/local-store";
import { parseLocalMutationPayload } from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const mutation: LocalStudioMutation =
      parseLocalMutationPayload(await request.json());
    const response = NextResponse.json(
      await mutateLocalSnapshot(
        mutation,
        getLocalProviderKeysFromRequest(request)
      )
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Local studio mutation failed.");
  }
}
