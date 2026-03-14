import { describe, expect, it } from "vitest";
import {
  reorderStudioFoldersByIds,
  sortStudioFoldersByOrder,
} from "./studio-folder-order";
import type { StudioFolder } from "./types";

const BASE_FOLDER: Omit<StudioFolder, "id" | "name" | "sortOrder"> = {
  userId: "user-1",
  workspaceId: "workspace-1",
  createdAt: "2026-03-13T10:00:00.000Z",
  updatedAt: "2026-03-13T10:00:00.000Z",
};

function createFolder(id: string, name: string, sortOrder: number, createdAt: string) {
  return {
    ...BASE_FOLDER,
    id,
    name,
    sortOrder,
    createdAt,
    updatedAt: createdAt,
  } satisfies StudioFolder;
}

describe("studio-folder-order", () => {
  it("sorts folders by sort order, then createdAt, then id", () => {
    const folders = [
      createFolder("b", "Folder B", 1, "2026-03-13T10:05:00.000Z"),
      createFolder("a", "Folder A", 0, "2026-03-13T10:10:00.000Z"),
      createFolder("c", "Folder C", 1, "2026-03-13T10:04:00.000Z"),
    ];

    expect(sortStudioFoldersByOrder(folders).map((folder) => folder.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("reorders requested folder ids and appends the rest in stable order", () => {
    const folders = [
      createFolder("a", "Folder A", 0, "2026-03-13T10:00:00.000Z"),
      createFolder("b", "Folder B", 1, "2026-03-13T10:01:00.000Z"),
      createFolder("c", "Folder C", 2, "2026-03-13T10:02:00.000Z"),
    ];

    const reordered = reorderStudioFoldersByIds(
      folders,
      ["c", "a"],
      "2026-03-13T11:00:00.000Z"
    );

    expect(reordered.map((folder) => folder.id)).toEqual(["c", "a", "b"]);
    expect(reordered.map((folder) => folder.sortOrder)).toEqual([0, 1, 2]);
    expect(reordered[0]?.updatedAt).toBe("2026-03-13T11:00:00.000Z");
    expect(reordered[2]?.updatedAt).toBe("2026-03-13T11:00:00.000Z");
  });
});
