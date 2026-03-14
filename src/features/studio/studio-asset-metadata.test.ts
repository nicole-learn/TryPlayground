import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMediaMetadataFromAspectRatioLabel,
  formatAspectRatioLabel,
  getDisplayAspectRatioFromMediaMetadata,
  getLibraryItemDisplayAspectRatio,
  parseAspectRatioLabel,
  readUploadedAssetMediaMetadata,
} from "./studio-asset-metadata";
import type { LibraryItem } from "./types";

describe("studio-asset-metadata", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses, formats, and derives aspect ratio metadata", () => {
    expect(parseAspectRatioLabel("16:9")).toEqual({ width: 16, height: 9 });
    expect(parseAspectRatioLabel("bad")).toBeNull();
    expect(formatAspectRatioLabel({ mediaWidth: 1920, mediaHeight: 1080 })).toBe(
      "16:9"
    );

    expect(createMediaMetadataFromAspectRatioLabel("image", "4:3")).toEqual({
      mediaWidth: 400,
      mediaHeight: 300,
      mediaDurationSeconds: null,
      aspectRatioLabel: "4:3",
      hasAlpha: false,
    });
    expect(
      getDisplayAspectRatioFromMediaMetadata({
        kind: "video",
        mediaWidth: null,
        mediaHeight: null,
        aspectRatioLabel: "16:9",
      })
    ).toBeCloseTo(16 / 9);
  });

  it("falls back to kind-based display ratios for assets missing metadata", () => {
    const item = {
      kind: "audio",
      mediaWidth: null,
      mediaHeight: null,
      aspectRatioLabel: null,
    } satisfies Pick<LibraryItem, "kind" | "mediaWidth" | "mediaHeight" | "aspectRatioLabel">;

    expect(getLibraryItemDisplayAspectRatio(item as LibraryItem)).toBeCloseTo(1.55);
  });

  it("reads uploaded image metadata from the preview url", async () => {
    const originalImage = globalThis.Image;

    class MockImage {
      naturalWidth = 1200;
      naturalHeight = 800;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    vi.stubGlobal("Image", MockImage);

    const metadata = await readUploadedAssetMediaMetadata({
      kind: "image",
      previewUrl: "blob:image-preview",
      mimeType: "image/png",
      hasAlpha: true,
    });

    expect(metadata.mediaWidth).toBe(1200);
    expect(metadata.mediaHeight).toBe(800);
    expect(metadata.aspectRatioLabel).toBe("3:2");
    expect(metadata.hasAlpha).toBe(true);

    globalThis.Image = originalImage;
  });

  it("reads uploaded video and audio metadata from media elements", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation(((tagName: string) => {
        if (tagName === "video") {
          const video = {
            videoWidth: 1920,
            videoHeight: 1080,
            onloadedmetadata: null as null | (() => void),
            onerror: null as null | (() => void),
            removeAttribute: vi.fn(),
            load: vi.fn(),
            preload: "",
            muted: false,
            playsInline: false,
            set src(_value: string) {
              this.onloadedmetadata?.();
            },
          };

          return video as unknown as HTMLVideoElement;
        }

        if (tagName === "audio") {
          const audio = {
            duration: 12.4,
            onloadedmetadata: null as null | (() => void),
            onerror: null as null | (() => void),
            removeAttribute: vi.fn(),
            load: vi.fn(),
            preload: "",
            set src(_value: string) {
              this.onloadedmetadata?.();
            },
          };

          return audio as unknown as HTMLAudioElement;
        }

        return originalCreateElement(tagName);
      }) as typeof document.createElement);

    const videoMetadata = await readUploadedAssetMediaMetadata({
      kind: "video",
      previewUrl: "blob:video-preview",
      mimeType: "video/mp4",
    });
    const audioMetadata = await readUploadedAssetMediaMetadata({
      kind: "audio",
      previewUrl: "blob:audio-preview",
      mimeType: "audio/mpeg",
    });

    expect(videoMetadata.aspectRatioLabel).toBe("16:9");
    expect(audioMetadata.mediaDurationSeconds).toBe(12.4);

    createElementSpy.mockRestore();
  });
});
