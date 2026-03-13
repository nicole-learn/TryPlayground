import { NextResponse } from "next/server";
import type { LocalStudioUploadManifestEntry } from "@/features/studio/studio-local-api";
import { uploadLocalFiles } from "@/server/local/local-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const folderIdValue = formData.get("folderId");
    const manifestValue = formData.get("manifest");
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    const manifest =
      typeof manifestValue === "string"
        ? (JSON.parse(manifestValue) as LocalStudioUploadManifestEntry[])
        : null;

    if (files.length === 0 || !manifest) {
      return NextResponse.json(
        { error: "Local upload payload was incomplete." },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      await uploadLocalFiles({
        files,
        manifest,
        folderId:
          typeof folderIdValue === "string" && folderIdValue.trim().length > 0
            ? folderIdValue
            : null,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Local upload failed.",
      },
      { status: 400 }
    );
  }
}
