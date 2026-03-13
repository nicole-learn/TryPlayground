import { NextResponse } from "next/server";
import { getLocalSyncPayload } from "@/server/local/local-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sinceRevisionValue = url.searchParams.get("sinceRevision");
  const sinceRevision =
    sinceRevisionValue && /^\d+$/.test(sinceRevisionValue)
      ? Number.parseInt(sinceRevisionValue, 10)
      : null;

  const response = NextResponse.json(getLocalSyncPayload(sinceRevision));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
