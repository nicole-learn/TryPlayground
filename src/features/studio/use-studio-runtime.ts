"use client";

import type { StudioAppMode } from "./studio-app-mode";
import { useStudioRuntimeCore } from "./use-studio-runtime-core";

export function useStudioRuntime(appMode: StudioAppMode) {
  return useStudioRuntimeCore(appMode);
}
