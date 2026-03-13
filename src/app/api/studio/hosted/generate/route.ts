import { NextResponse } from "next/server";
import type {
  HostedStudioGenerateInputDescriptor,
} from "@/features/studio/studio-hosted-mock-api";
import type { GenerationRun, PersistedStudioDraft } from "@/features/studio/types";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { queueHostedGeneration } from "@/server/studio/hosted-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const formData = await request.formData();
    const modelId = String(formData.get("modelId") ?? "").trim();
    const folderIdValue = formData.get("folderId");
    const draftValue = formData.get("draft");
    const inputsValue = formData.get("inputs");

    if (!modelId) {
      throw new Error("Model id is required.");
    }

    const draft = draftValue
      ? (JSON.parse(String(draftValue)) as GenerationRun["draftSnapshot"] | PersistedStudioDraft)
      : null;

    if (!draft) {
      throw new Error("Generation draft is required.");
    }

    const inputs = inputsValue
      ? (JSON.parse(String(inputsValue)) as HostedStudioGenerateInputDescriptor[])
      : [];

    const uploadedFiles = new Map<string, File>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("input-file:") || !(value instanceof File)) {
        continue;
      }

      uploadedFiles.set(key.slice("input-file:".length), value);
    }

    const response = NextResponse.json(
      await queueHostedGeneration({
        supabase,
        user,
        modelId,
        folderId:
          typeof folderIdValue === "string" && folderIdValue.trim().length > 0
            ? folderIdValue
            : null,
        draft,
        inputs,
        uploadedFiles,
      })
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not queue hosted generation.",
      },
      { status: 400 }
    );
  }
}
