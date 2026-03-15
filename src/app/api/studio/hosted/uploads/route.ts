import { NextResponse } from "next/server";
import type { HostedStudioUploadManifestEntry } from "@/features/studio/studio-hosted-api";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { uploadHostedFiles } from "@/server/studio/hosted-store";
import {
  parseHostedUploadManifest,
  parseOptionalFolderId,
  validateStudioFileBatch,
} from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    validateStudioFileBatch(files, "hosted upload");
    const folderId = parseOptionalFolderId(formData.get("folderId"));
    const manifest: HostedStudioUploadManifestEntry[] =
      parseHostedUploadManifest(formData.get("manifest"));

    const response = NextResponse.json(
      await uploadHostedFiles({
        supabase,
        user,
        files,
        folderId,
        manifest,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Hosted upload failed.");
  }
}
