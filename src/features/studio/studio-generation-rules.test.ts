import { describe, expect, it } from "vitest";
import {
  canGenerateWithDraft,
  getHostedStudioConcurrencyLimit,
  getHostedStudioFairShare,
  getStudioRunCompletionDelayMs,
  resolveStudioGenerationRequestMode,
  shouldStudioMockRunFail,
} from "./studio-generation-rules";

describe("studio-generation-rules", () => {
  it("computes hosted concurrency from provider slots and active users", () => {
    expect(
      getHostedStudioConcurrencyLimit({
        activeHostedUserCount: 1,
        providerSlotLimit: 30,
      })
    ).toBe(30);

    expect(
      getHostedStudioConcurrencyLimit({
        activeHostedUserCount: 4,
        providerSlotLimit: 30,
      })
    ).toBe(7);
  });

  it("rotates the remainder slots fairly across active hosted users", () => {
    const userA = getHostedStudioFairShare({
      queueSettings: {
        activeHostedUserCount: 4,
        providerSlotLimit: 30,
      },
      userId: "user-a",
      now: 0,
    });
    const userB = getHostedStudioFairShare({
      queueSettings: {
        activeHostedUserCount: 4,
        providerSlotLimit: 30,
      },
      userId: "user-b",
      now: 1400,
    });

    expect(userA.maxProcessing).toBeGreaterThanOrEqual(7);
    expect(userA.maxProcessing).toBeLessThanOrEqual(8);
    expect(userB.maxProcessing).toBeGreaterThanOrEqual(7);
    expect(userB.maxProcessing).toBeLessThanOrEqual(8);
    expect(userA.rotationSliceMs).toBeGreaterThan(0);
    expect(userA.nextRetryDelayMs).toBeGreaterThan(0);
  });

  it("resolves video request mode from references and frame inputs", () => {
    const model = {
      kind: "video" as const,
      requestMode: "text-to-video" as const,
      supportsFrameInputs: true,
      supportsEndFrame: true,
    };
    const emptyDraft = {
      references: [],
      startFrame: null,
      endFrame: null,
      videoInputMode: "frames" as const,
    };

    expect(resolveStudioGenerationRequestMode(model, emptyDraft)).toBe("text-to-video");
    expect(
      resolveStudioGenerationRequestMode(model, {
        ...emptyDraft,
        startFrame: {} as never,
      })
    ).toBe("image-to-video");
    expect(
      resolveStudioGenerationRequestMode(model, {
        ...emptyDraft,
        startFrame: {} as never,
        endFrame: {} as never,
      })
    ).toBe("first-last-frame-to-video");
    expect(
      resolveStudioGenerationRequestMode(model, {
        ...emptyDraft,
        videoInputMode: "references",
        references: [{} as never, {} as never],
      })
    ).toBe("reference-to-video");
  });

  it("requires prompt and minimum references when the model does", () => {
    expect(
      canGenerateWithDraft(
        { minimumReferenceFiles: 0, requiresPrompt: true },
        { prompt: "", references: [] }
      )
    ).toBe(false);

    expect(
      canGenerateWithDraft(
        { minimumReferenceFiles: 2, requiresPrompt: false },
        { prompt: "", references: [{} as never] }
      )
    ).toBe(false);

    expect(
      canGenerateWithDraft(
        { minimumReferenceFiles: 1, requiresPrompt: true },
        { prompt: "hello", references: [{} as never] }
      )
    ).toBe(true);
  });

  it("marks fail/error prompts as mock failures and maps completion delays by kind", () => {
    expect(shouldStudioMockRunFail({ prompt: "please fail this run" })).toBe(true);
    expect(shouldStudioMockRunFail({ prompt: "all good here" })).toBe(false);
    expect(getStudioRunCompletionDelayMs({ kind: "video" })).toBeGreaterThan(
      getStudioRunCompletionDelayMs({ kind: "text" })
    );
  });
});
