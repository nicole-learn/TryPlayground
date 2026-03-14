import { describe, expect, it } from "vitest";
import {
  createAudioThumbnailForModel,
  createAudioThumbnailUrl,
  getLibraryItemThumbnailUrl,
  isTransparentImageItem,
} from "./studio-asset-thumbnails";
import { getStudioModelById } from "./studio-model-catalog";

describe("studio-asset-thumbnails", () => {
  it("creates an encoded audio thumbnail url and escapes unsafe text", () => {
    const url = createAudioThumbnailUrl({
      title: `Voice <Demo>`,
      subtitle: `Line & "Quote"`,
      accentSeed: "seed-1",
    });

    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain("&lt;Demo&gt;");
    expect(decodeURIComponent(url)).toContain("&amp;");
  });

  it("falls back from thumbnail url to preview url", () => {
    expect(
      getLibraryItemThumbnailUrl({
        thumbnailUrl: null,
        previewUrl: "https://cdn.test/preview.jpg",
      })
    ).toBe("https://cdn.test/preview.jpg");
  });

  it("identifies transparent image assets", () => {
    expect(
      isTransparentImageItem({
        kind: "image",
        hasAlpha: true,
      })
    ).toBe(true);

    expect(
      isTransparentImageItem({
        kind: "video",
        hasAlpha: true,
      })
    ).toBe(false);
  });

  it("creates model-specific audio thumbnails", () => {
    const model = getStudioModelById("minimax-speech-2.8-hd");
    const url = createAudioThumbnailForModel({
      model,
      title: "Narration",
      subtitle: "This is a generated voice sample.",
    });

    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Narration");
  });
});
