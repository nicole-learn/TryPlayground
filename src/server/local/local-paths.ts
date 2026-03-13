import os from "node:os";
import path from "node:path";
import fs from "node:fs";

function resolveBaseDirectory() {
  const override = process.env.TRYPLAYGROUND_LOCAL_DATA_DIR?.trim();
  if (override) {
    return override;
  }

  const home = os.homedir();
  const platform = process.platform;

  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "TryPlayground");
  }

  if (platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    return path.join(appData || path.join(home, "AppData", "Roaming"), "TryPlayground");
  }

  const xdgDataHome = process.env.XDG_DATA_HOME?.trim();
  return path.join(xdgDataHome || path.join(home, ".local", "share"), "TryPlayground");
}

export function getLocalDataRoot() {
  return resolveBaseDirectory();
}

export function getLocalDatabaseDirectory() {
  return path.join(getLocalDataRoot(), "db");
}

export function getLocalDatabasePath() {
  return path.join(getLocalDatabaseDirectory(), "local.sqlite");
}

export function getLocalStorageRoot() {
  return path.join(getLocalDataRoot(), "storage");
}

export function getLocalLogsDirectory() {
  return path.join(getLocalDataRoot(), "logs");
}

export function ensureLocalDataDirectories() {
  const directories = [
    getLocalDataRoot(),
    getLocalDatabaseDirectory(),
    getLocalStorageRoot(),
    path.join(getLocalStorageRoot(), "items"),
    path.join(getLocalStorageRoot(), "runs"),
    path.join(getLocalStorageRoot(), "temp"),
    getLocalLogsDirectory(),
  ];

  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function getLocalItemSourceDirectory(itemId: string) {
  return path.join(getLocalStorageRoot(), "items", itemId, "source");
}

export function getLocalItemThumbnailDirectory(itemId: string) {
  return path.join(getLocalStorageRoot(), "items", itemId, "thumbnail");
}

export function getLocalRunInputDirectory(runId: string) {
  return path.join(getLocalStorageRoot(), "runs", runId, "inputs");
}
