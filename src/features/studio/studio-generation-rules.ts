import type { StudioAppMode } from "./studio-app-mode";
import type {
  GenerationRun,
  StudioDraft,
  StudioQueueSettings,
} from "./types";

type CreditQuoteDraft = Pick<StudioDraft, "durationSeconds" | "resolution">;
type RunTimingShape = Pick<GenerationRun, "kind" | "prompt">;
type HostedQueueShape = Pick<
  StudioQueueSettings,
  "activeHostedUserCount" | "providerSlotLimit"
>;

export function quoteStudioDraftCredits(
  modelId: string,
  draft: CreditQuoteDraft
) {
  if (modelId === "veo-3.1") {
    const durationMultiplier = Math.max(1, Math.round(draft.durationSeconds / 4));
    const resolutionBase =
      draft.resolution === "4K" ? 24 : draft.resolution === "1080p" ? 16 : 12;
    return resolutionBase + Math.max(0, durationMultiplier - 1) * 4;
  }

  if (modelId === "nano-banana-2") {
    if (draft.resolution === "4K") return 10;
    if (draft.resolution === "2K") return 7;
    return 4;
  }

  return 1;
}

export function getHostedStudioConcurrencyLimit(queueSettings: HostedQueueShape) {
  const activeUsers = Math.max(queueSettings.activeHostedUserCount, 1);
  return Math.max(1, Math.floor(queueSettings.providerSlotLimit / activeUsers));
}

export function getStudioConcurrencyLimitForMode(
  mode: StudioAppMode,
  queueSettings: StudioQueueSettings
) {
  if (mode === "hosted") {
    return getHostedStudioConcurrencyLimit(queueSettings);
  }

  return queueSettings.localConcurrencyLimit;
}

export function getStudioRunCompletionDelayMs(run: Pick<RunTimingShape, "kind">) {
  if (run.kind === "video") {
    return 3200;
  }

  if (run.kind === "text") {
    return 1200;
  }

  return 1800;
}

export function shouldStudioMockRunFail(run: Pick<RunTimingShape, "prompt">) {
  return /\b(fail|error)\b/i.test(run.prompt);
}
