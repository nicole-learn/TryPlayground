"use client";

import { useStudioMockRuntime } from "./use-studio-mock-runtime";

export function useStudioHostedRuntime() {
  return useStudioMockRuntime("hosted");
}
