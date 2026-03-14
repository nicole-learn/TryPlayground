import { describe, expect, it } from "vitest";
import {
  getStudioUploadedMediaKind,
  studioUploadSupportsAlpha,
} from "./studio-upload-files";

describe("studio-upload-files", () => {
  it("detects uploaded media kinds from mime types and file extensions", () => {
    expect(
      getStudioUploadedMediaKind({
        fileName: "photo.png",
        mimeType: "",
      })
    ).toBe("image");

    expect(
      getStudioUploadedMediaKind({
        fileName: "clip.unknown",
        mimeType: "video/mp4",
      })
    ).toBe("video");

    expect(
      getStudioUploadedMediaKind({
        fileName: "voice.flac",
        mimeType: null,
      })
    ).toBe("audio");

    expect(
      getStudioUploadedMediaKind({
        fileName: "notes.txt",
        mimeType: "text/plain",
      })
    ).toBeNull();
  });

  it("knows which upload formats support alpha", () => {
    expect(studioUploadSupportsAlpha("image/png")).toBe(true);
    expect(studioUploadSupportsAlpha("image/svg+xml")).toBe(true);
    expect(studioUploadSupportsAlpha("image/jpeg")).toBe(false);
  });
});
