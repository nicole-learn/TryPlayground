import type { StudioFolder } from "./types";

export function sortStudioFoldersByOrder(folders: StudioFolder[]) {
  return [...folders].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.id.localeCompare(right.id);
  });
}

export function reorderStudioFoldersByIds(
  folders: StudioFolder[],
  orderedFolderIds: string[],
  updatedAt: string
) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const nextFolders = orderedFolderIds
    .map((folderId) => folderMap.get(folderId))
    .filter((folder): folder is StudioFolder => Boolean(folder));
  const includedIds = new Set(nextFolders.map((folder) => folder.id));
  const remainingFolders = sortStudioFoldersByOrder(folders).filter(
    (folder) => !includedIds.has(folder.id)
  );

  return [...nextFolders, ...remainingFolders].map((folder, index) => ({
    ...folder,
    sortOrder: index,
    updatedAt: folder.sortOrder === index ? folder.updatedAt : updatedAt,
  }));
}
