import {
  getStudioModelById,
  getStudioModelIds,
  getStudioModelsForPromptBar,
} from "./studio-model-catalog";

const DEFAULT_STUDIO_ENABLED_MODEL_IDS = [
  "nano-banana-2",
  "gemini-2.5-flash",
  "veo-3.1",
  "claude-opus-4.6",
];

export function createDefaultStudioEnabledModelIds() {
  const validIdSet = new Set(getStudioModelIds());
  return DEFAULT_STUDIO_ENABLED_MODEL_IDS.filter((modelId) => validIdSet.has(modelId));
}

export function normalizeStudioEnabledModelIds(
  enabledModelIds: string[] | null | undefined
) {
  const validIds = getStudioModelIds();
  const validIdSet = new Set(validIds);
  const defaultIds = createDefaultStudioEnabledModelIds();
  const dedupedValidIds = Array.from(
    new Set((enabledModelIds ?? []).filter((modelId) => validIdSet.has(modelId)))
  );

  return dedupedValidIds.length > 0 ? dedupedValidIds : defaultIds;
}

export function getConfiguredStudioModels(enabledModelIds: string[]) {
  return getStudioModelsForPromptBar(normalizeStudioEnabledModelIds(enabledModelIds));
}

export function resolveConfiguredStudioModelId(params: {
  currentModelId: string;
  enabledModelIds: string[];
}) {
  const enabledModels = getConfiguredStudioModels(params.enabledModelIds);
  if (enabledModels.some((model) => model.id === params.currentModelId)) {
    return params.currentModelId;
  }

  const currentModel = getStudioModelById(params.currentModelId);

  return (
    enabledModels.find(
      (model) =>
        model.section === currentModel.section && model.kind === currentModel.kind
    )?.id ??
    enabledModels[0]?.id ??
    params.currentModelId
  );
}

export function toggleStudioModelEnabled(params: {
  enabledModelIds: string[];
  modelId: string;
}) {
  const normalized = normalizeStudioEnabledModelIds(params.enabledModelIds);

  if (normalized.includes(params.modelId)) {
    if (normalized.length === 1) {
      return normalized;
    }

    return normalized.filter((modelId) => modelId !== params.modelId);
  }

  return normalizeStudioEnabledModelIds([...normalized, params.modelId]);
}
