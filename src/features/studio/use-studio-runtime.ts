"use client";

import type { StudioAppMode } from "./studio-app-mode";
import { useStudioMockRuntime } from "./use-studio-mock-runtime";

export function useStudioRuntime(appMode: StudioAppMode) {
  return useStudioMockRuntime(appMode);
}
