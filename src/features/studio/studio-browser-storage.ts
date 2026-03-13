"use client";

import type { StudioProviderSettings } from "./types";

const STORAGE_KEYS = {
  gridDensity: "vydelabs.studio.gridDensity",
  providerSettings: "vydelabs.studio.providerSettings",
} as const;

const LEGACY_STORAGE_KEYS = {
  providerSettings: "vydelabs.studio.settings",
} as const;

function getLocalStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function getSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function readJson<T>(storage: Storage | null, key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) return null;
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures so the studio remains usable in restricted browsers.
  }
}

function removeValue(storage: Storage | null, key: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures so the studio remains usable in restricted browsers.
  }
}

export function loadStoredGridDensity() {
  const value = readJson<number>(getLocalStorage(), STORAGE_KEYS.gridDensity);
  return typeof value === "number" && value >= 0 && value <= 6 ? value : null;
}

export function saveStoredGridDensity(value: number) {
  writeJson(getLocalStorage(), STORAGE_KEYS.gridDensity, value);
}

function removeLegacyProviderSettings() {
  removeValue(getLocalStorage(), LEGACY_STORAGE_KEYS.providerSettings);
}

export function loadStoredProviderSettings(): StudioProviderSettings | null {
  removeLegacyProviderSettings();

  const value = readJson<Partial<StudioProviderSettings>>(
    getSessionStorage(),
    STORAGE_KEYS.providerSettings
  );
  if (!value || typeof value.falApiKey !== "string") {
    return null;
  }

  return {
    falApiKey: value.falApiKey.trim(),
  };
}

export function saveStoredProviderSettings(value: StudioProviderSettings) {
  removeLegacyProviderSettings();

  const falApiKey = value.falApiKey.trim();
  if (!falApiKey) {
    removeValue(getSessionStorage(), STORAGE_KEYS.providerSettings);
    return;
  }

  writeJson(getSessionStorage(), STORAGE_KEYS.providerSettings, {
    falApiKey,
  });
}
