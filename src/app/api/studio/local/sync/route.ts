import { NextResponse } from "next/server";
import { getLocalProviderKeysFromRequest } from "@/server/fal/studio-fal";
import { getLocalSyncPayload } from "@/server/local/local-store";
import { createStudioRouteError, toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sinceRevisionValue = url.searchParams.get("sinceRevision");
    if (sinceRevisionValue && !/^\d+$/.test(sinceRevisionValue)) {
      createStudioRouteError(400, "The local sync revision was invalid.");
    }

    const sinceRevision =
      sinceRevisionValue && /^\d+$/.test(sinceRevisionValue)
        ? Number.parseInt(sinceRevisionValue, 10)
        : null;

    const response = NextResponse.json(
      await getLocalSyncPayload(
        sinceRevision,
        getLocalProviderKeysFromRequest(request)
      )
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Could not sync the local workspace.");
  }
}
