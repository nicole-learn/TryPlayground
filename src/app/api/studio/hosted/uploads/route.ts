import { NextResponse } from "next/server";
import type { HostedStudioUploadManifestEntry } from "@/features/studio/studio-hosted-mock-api";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { uploadHostedFiles } from "@/server/studio/hosted-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const formData = await request.formData();
    const folderIdValue = formData.get("folderId");
    const manifestValue = formData.get("manifest");
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    const manifest = manifestValue
      ? (JSON.parse(String(manifestValue)) as HostedStudioUploadManifestEntry[])
      : [];

    const response = NextResponse.json(
      await uploadHostedFiles({
        supabase,
        user,
        files,
        folderId:
          typeof folderIdValue === "string" && folderIdValue.trim().length > 0
            ? folderIdValue
            : null,
        manifest,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Hosted upload failed.",
      },
      { status: 400 }
    );
  }
}
