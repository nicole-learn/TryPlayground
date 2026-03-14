"use client";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStudioAppMode } from "./studio-app-mode";

describe("useStudioAppMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to local mode in development", () => {
    const { result } = renderHook(() => useStudioAppMode());

    expect(result.current.appMode).toBe("local");
    expect(result.current.canSwitchModes).toBe(true);
  });

  it("persists and publishes app mode changes", () => {
    const first = renderHook(() => useStudioAppMode());
    const second = renderHook(() => useStudioAppMode());

    act(() => {
      first.result.current.setAppMode("hosted");
    });

    expect(window.localStorage.getItem("tryplayground.dev.appMode")).toBe("hosted");
    expect(first.result.current.appMode).toBe("hosted");
    expect(second.result.current.appMode).toBe("hosted");
  });
});
