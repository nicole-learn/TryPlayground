import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudioGallery } from "./studio-gallery";
import type { LibraryItem } from "../types";

function createTextItem(source: "uploaded" | "generated"): LibraryItem {
  return {
    id: `item-${source}`,
    userId: "user-1",
    workspaceId: "workspace-1",
    runFileId: null,
    sourceRunId: null,
    title: "Alpha note",
    kind: "text",
    source,
    role: source === "generated" ? "generated_output" : "uploaded_source",
    previewUrl: null,
    thumbnailUrl: null,
    contentText: "This is a plain text card in the gallery.",
    createdAt: "2026-03-14T10:00:00.000Z",
    updatedAt: "2026-03-14T10:00:00.000Z",
    modelId: null,
    runId: null,
    provider: "fal",
    status: "ready",
    prompt: "",
    meta: "Helpful note",
    mediaWidth: null,
    mediaHeight: null,
    mediaDurationSeconds: null,
    aspectRatioLabel: null,
    hasAlpha: false,
    folderId: null,
    storageBucket: "local-fs",
    storagePath: null,
    thumbnailPath: null,
    fileName: "alpha-note.txt",
    mimeType: "text/plain",
    byteSize: 42,
    metadata: {},
    errorMessage: null,
  };
}

describe("StudioGallery text cards", () => {
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth"
  );

  afterEach(() => {
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
      return;
    }

    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("does not render uploaded or generated source labels on text cards", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 960,
    });

    render(
      <StudioGallery
        emptyStateLabel="No assets"
        items={[createTextItem("uploaded"), createTextItem("generated")]}
        selectedItemIdSet={new Set()}
        selectionModeEnabled={false}
        sizeLevel={2}
        onDeleteItem={vi.fn()}
        onDownloadItem={vi.fn()}
        onOpenItem={vi.fn()}
        onReuseItem={vi.fn()}
        onToggleItemSelection={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText("This is a plain text card in the gallery.")).toHaveLength(2);
    });

    expect(screen.queryByText("uploaded")).not.toBeInTheDocument();
    expect(screen.queryByText("generated")).not.toBeInTheDocument();
  });
});
