import { beforeEach, describe, expect, it } from "vitest";
import {
  loadStoredProviderSettings,
  saveStoredProviderSettings,
} from "./studio-browser-storage";

describe("studio-browser-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("stores provider settings in session storage only and trims the key", () => {
    saveStoredProviderSettings({
      falApiKey: "  fal_test_key  ",
      falLastValidatedAt: "2026-03-13T10:00:00.000Z",
      openaiApiKey: "",
      openaiLastValidatedAt: null,
      anthropicApiKey: "",
      anthropicLastValidatedAt: null,
      geminiApiKey: "",
      geminiLastValidatedAt: null,
    });

    expect(loadStoredProviderSettings()).toEqual({
      falApiKey: "fal_test_key",
      falLastValidatedAt: "2026-03-13T10:00:00.000Z",
      openaiApiKey: "",
      openaiLastValidatedAt: null,
      anthropicApiKey: "",
      anthropicLastValidatedAt: null,
      geminiApiKey: "",
      geminiLastValidatedAt: null,
    });
  });

  it("removes the session value when the key is blank", () => {
    saveStoredProviderSettings({
      falApiKey: "   ",
      falLastValidatedAt: "2026-03-13T10:00:00.000Z",
      openaiApiKey: "",
      openaiLastValidatedAt: null,
      anthropicApiKey: "",
      anthropicLastValidatedAt: null,
      geminiApiKey: "",
      geminiLastValidatedAt: null,
    });

    expect(loadStoredProviderSettings()).toBeNull();
  });

  it("restores non-Fal provider-only settings correctly", () => {
    saveStoredProviderSettings({
      falApiKey: "",
      falLastValidatedAt: null,
      openaiApiKey: "  sk-openai-test  ",
      openaiLastValidatedAt: "2026-03-14T12:00:00.000Z",
      anthropicApiKey: "",
      anthropicLastValidatedAt: null,
      geminiApiKey: "",
      geminiLastValidatedAt: null,
    });

    expect(loadStoredProviderSettings()).toEqual({
      falApiKey: "",
      falLastValidatedAt: null,
      openaiApiKey: "sk-openai-test",
      openaiLastValidatedAt: "2026-03-14T12:00:00.000Z",
      anthropicApiKey: "",
      anthropicLastValidatedAt: null,
      geminiApiKey: "",
      geminiLastValidatedAt: null,
    });
  });
});
