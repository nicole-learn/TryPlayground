import { describe, expect, it } from "vitest";
import {
  createDefaultStudioEnabledModelIds,
  getConfiguredStudioModels,
  normalizeStudioEnabledModelIds,
  resolveConfiguredStudioModelId,
  toggleStudioModelEnabled,
} from "./studio-model-configuration";

describe("studio-model-configuration", () => {
  it("returns the curated default enabled model ids", () => {
    expect(createDefaultStudioEnabledModelIds()).toEqual([
      "nano-banana-2",
      "gemini-2.5-flash",
      "veo-3.1",
      "claude-opus-4.6",
    ]);
  });

  it("normalizes invalid or duplicate ids and falls back to curated defaults", () => {
    expect(
      normalizeStudioEnabledModelIds([
        "nano-banana-2",
        "nano-banana-2",
        "invalid-model",
        "veo-3.1",
      ])
    ).toEqual(["nano-banana-2", "veo-3.1"]);

    expect(normalizeStudioEnabledModelIds([])).toEqual(
      createDefaultStudioEnabledModelIds()
    );
  });

  it("returns only configured prompt-bar models", () => {
    const models = getConfiguredStudioModels(["veo-3.1", "claude-opus-4.6"]);
    expect(models.map((model) => model.id)).toEqual([
      "veo-3.1",
      "claude-opus-4.6",
    ]);
  });

  it("resolves disabled models to a visible model in the same section first", () => {
    expect(
      resolveConfiguredStudioModelId({
        currentModelId: "gpt-4.1",
        enabledModelIds: ["nano-banana-2", "claude-opus-4.6"],
      })
    ).toBe("claude-opus-4.6");
  });

  it("does not remove the last remaining enabled model", () => {
    expect(
      toggleStudioModelEnabled({
        enabledModelIds: ["nano-banana-2"],
        modelId: "nano-banana-2",
      })
    ).toEqual(["nano-banana-2"]);
  });

  it("adds a disabled model back into the normalized enabled set", () => {
    expect(
      toggleStudioModelEnabled({
        enabledModelIds: ["nano-banana-2", "veo-3.1"],
        modelId: "claude-opus-4.6",
      })
    ).toEqual(["nano-banana-2", "veo-3.1", "claude-opus-4.6"]);
  });
});
