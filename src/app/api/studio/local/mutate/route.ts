import { NextResponse } from "next/server";
import type { LocalStudioMutation } from "@/features/studio/studio-local-api";
import { mutateLocalSnapshot } from "@/server/local/local-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const mutation = (await request.json()) as LocalStudioMutation;
    const response = NextResponse.json(await mutateLocalSnapshot(mutation));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Local studio mutation failed.",
      },
      { status: 400 }
    );
  }
}
