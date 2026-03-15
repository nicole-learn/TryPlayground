import { NextResponse } from "next/server";
import type { LocalStudioUploadManifestEntry } from "@/features/studio/studio-local-api";
import { uploadLocalFiles } from "@/server/local/local-store";
import {
  parseLocalUploadManifest,
  parseOptionalFolderId,
  validateStudioFileBatch,
} from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    validateStudioFileBatch(files, "local upload");
    const folderId = parseOptionalFolderId(formData.get("folderId"));
    const manifest: LocalStudioUploadManifestEntry[] =
      parseLocalUploadManifest(formData.get("manifest"));

    const response = NextResponse.json(
      await uploadLocalFiles({
        files,
        manifest,
        folderId,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Local upload failed.");
  }
}
