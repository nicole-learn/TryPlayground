import { NextResponse } from "next/server";
import { getLocalProviderKeysFromRequest } from "@/server/fal/studio-fal";
import { getLocalBootstrapPayload } from "@/server/local/local-store";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const response = NextResponse.json(
      await getLocalBootstrapPayload(getLocalProviderKeysFromRequest(request))
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Could not load the local workspace.");
  }
}
