"use client";

import type { LibraryItem } from "./types";

function getDownloadFileName(item: LibraryItem) {
  const safeBaseName =
    item.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "asset";

  if (item.kind === "text") {
    return `${safeBaseName}.txt`;
  }

  if (item.kind === "video") {
    return `${safeBaseName}.mp4`;
  }

  if (item.kind === "image") {
    return `${safeBaseName}.png`;
  }

  return safeBaseName;
}

export function downloadLibraryItem(item: LibraryItem) {
  if (typeof window === "undefined") return;

  if (item.kind === "text") {
    const blob = new Blob([item.contentText || item.prompt || item.title], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDownloadFileName(item);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  if (!item.previewUrl) return;

  const link = document.createElement("a");
  link.href = item.previewUrl;
  link.download = getDownloadFileName(item);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadFolderItems(items: LibraryItem[]) {
  if (items.length === 0 || typeof window === "undefined") return;

  items.forEach((item, index) => {
    window.setTimeout(() => {
      downloadLibraryItem(item);
    }, index * 120);
  });
}
