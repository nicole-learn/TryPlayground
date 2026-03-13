"use client";

import { createStudioId } from "./studio-local-runtime-data";
import type { LibraryItem, StudioFolder } from "./types";

export function revokePreviewUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function releaseUploadedPreview(
  item: LibraryItem | undefined,
  previewUrls: Map<string, string>
) {
  if (!item || item.source !== "uploaded" || !item.previewUrl) {
    return;
  }

  revokePreviewUrl(previewUrls.get(item.id) ?? item.previewUrl);
  previewUrls.delete(item.id);
}

export function createFolderItemCounts(
  folders: StudioFolder[],
  items: LibraryItem[]
) {
  return Object.fromEntries(
    folders.map((folder) => [
      folder.id,
      items.filter((item) => item.folderId === folder.id).length,
    ])
  ) as Record<string, number>;
}

export function removePendingTimerId(timerIds: number[], timerId: number) {
  return timerIds.filter((entry) => entry !== timerId);
}

export function createTextLibraryItem(params: {
  title: string;
  body: string;
  folderId: string | null;
}): LibraryItem {
  const trimmedBody = params.body.trim();
  const fallbackTitle = trimmedBody.slice(0, 36) || "Text note";

  return {
    id: createStudioId("asset"),
    title: params.title.trim() || fallbackTitle,
    kind: "text",
    source: "uploaded",
    previewUrl: null,
    contentText: trimmedBody,
    createdAt: new Date().toISOString(),
    modelId: null,
    prompt: trimmedBody,
    meta: "Text note",
    aspectRatio: 0.82,
    folderId: params.folderId,
  };
}

export function createUploadedLibraryItem(
  file: File,
  folderId: string | null
): LibraryItem {
  const fileType = file.type.toLowerCase();
  const kind =
    fileType.startsWith("image/")
      ? "image"
      : fileType.startsWith("video/")
        ? "video"
        : "file";
  const previewUrl =
    kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
  const aspectRatio =
    kind === "video" ? 16 / 9 : kind === "image" ? 4 / 5 : 0.82;

  return {
    id: createStudioId("asset"),
    title: file.name,
    kind,
    source: "uploaded",
    previewUrl,
    contentText: null,
    createdAt: new Date().toISOString(),
    modelId: null,
    prompt: "",
    meta: `${file.type || "File"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`,
    aspectRatio,
    folderId,
  };
}

export function hasFolderNameConflict(
  folders: StudioFolder[],
  nextName: string,
  targetFolderId: string | null
) {
  const normalizedName = nextName.trim().toLowerCase();
  return folders.some(
    (folder) =>
      folder.id !== targetFolderId &&
      folder.name.trim().toLowerCase() === normalizedName
  );
}
