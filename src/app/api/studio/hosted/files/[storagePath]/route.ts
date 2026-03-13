import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { downloadHostedFile } from "@/server/studio/hosted-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ storagePath: string }> }
) {
  try {
    const { supabase } = await requireSupabaseUser(request);
    const { storagePath } = await context.params;
    const blob = await downloadHostedFile({
      supabase,
      storagePath: decodeURIComponent(storagePath),
    });

    return new NextResponse(blob, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Type": blob.type || "application/octet-stream",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load hosted file.",
      },
      { status: 404 }
    );
  }
}
