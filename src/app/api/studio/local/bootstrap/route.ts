import { NextResponse } from "next/server";
import { getLocalBootstrapPayload } from "@/server/local/local-store";

export const runtime = "nodejs";

export async function GET() {
  const response = NextResponse.json(getLocalBootstrapPayload());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
