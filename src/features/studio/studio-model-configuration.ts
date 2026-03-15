import {
  getStudioModelById,
  getStudioModelIds,
  getStudioModelsForPromptBar,
  STUDIO_MODEL_CATALOG_ALPHABETICAL,
  STUDIO_TEXT_MODEL_FAMILIES,
} from "./studio-model-catalog";
import type { StudioModelConfigurationEntry } from "./types";

const DEFAULT_STUDIO_ENABLED_MODEL_IDS = [
  "nano-banana-2",
  "veo-3.1",
  ...STUDIO_TEXT_MODEL_FAMILIES.flatMap((family) => family.modelIds),
];

export const STUDIO_MODEL_CONFIGURATION_ENTRIES: StudioModelConfigurationEntry[] = [
  ...STUDIO_TEXT_MODEL_FAMILIES,
  ...STUDIO_MODEL_CATALOG_ALPHABETICAL.filter((model) => !model.familyId).map((model) => ({
    id: model.id,
    label: model.name,
    modelIds: [model.id],
  })),
].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));

function getConfigurationEntryById(entryId: string) {
  return (
    STUDIO_MODEL_CONFIGURATION_ENTRIES.find((entry) => entry.id === entryId) ?? {
      id: entryId,
      label: entryId,
      modelIds: [entryId],
    }
  );
}

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
  const expandedTextFamilies = STUDIO_TEXT_MODEL_FAMILIES.flatMap((family) => {
    const enabledFamilyModelIds = family.modelIds.filter((modelId) =>
      dedupedValidIds.includes(modelId)
    );

    if (enabledFamilyModelIds.length === 0) {
      return [];
    }

    return family.modelIds;
  });
  const normalizedIds = Array.from(
    new Set(
      dedupedValidIds
        .filter((modelId) => !getStudioModelById(modelId).familyId)
        .concat(expandedTextFamilies)
    )
  );

  return normalizedIds.length > 0 ? normalizedIds : defaultIds;
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
  const entry = getConfigurationEntryById(params.modelId);
  const isEnabled = entry.modelIds.every((modelId) => normalized.includes(modelId));
  const nextEnabledIds = isEnabled
    ? normalized.filter((modelId) => !entry.modelIds.includes(modelId))
    : [...normalized, ...entry.modelIds];

  if (nextEnabledIds.length === 0) {
    return normalized;
  }

  return normalizeStudioEnabledModelIds(nextEnabledIds);
}

export function isStudioModelConfigurationEntryEnabled(params: {
  entryId: string;
  enabledModelIds: string[];
}) {
  const normalized = normalizeStudioEnabledModelIds(params.enabledModelIds);
  const entry = getConfigurationEntryById(params.entryId);
  return entry.modelIds.every((modelId) => normalized.includes(modelId));
}
