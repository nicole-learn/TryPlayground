import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { downloadHostedFile } from "@/server/studio/hosted-store";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

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
        Vary: "Cookie, Authorization",
      },
    });
  } catch (error) {
    return toStudioErrorResponse(error, "Could not load hosted file.", 404);
  }
}
