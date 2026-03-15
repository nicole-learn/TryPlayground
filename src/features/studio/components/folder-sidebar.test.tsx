import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FolderSidebar } from "./folder-sidebar";
import type { StudioFolder } from "../types";

const FOLDERS: StudioFolder[] = [
  {
    id: "folder-1",
    userId: "user-1",
    workspaceId: "workspace-1",
    name: "Projects",
    createdAt: "2026-03-14T10:00:00.000Z",
    updatedAt: "2026-03-14T10:00:00.000Z",
    sortOrder: 0,
  },
  {
    id: "folder-2",
    userId: "user-1",
    workspaceId: "workspace-1",
    name: "References",
    createdAt: "2026-03-14T10:00:00.000Z",
    updatedAt: "2026-03-14T10:00:00.000Z",
    sortOrder: 1,
  },
];

describe("FolderSidebar", () => {
  it("uses primary colors for the selected folder row", () => {
    render(
      <FolderSidebar
        folderCounts={{ "folder-1": 3, "folder-2": 1 }}
        folders={FOLDERS}
        onCopyFolderId={vi.fn()}
        onReorderFolders={vi.fn()}
        onRequestDeleteFolder={vi.fn()}
        selectedFolderId="folder-1"
        onCreateFolder={vi.fn()}
        onDownloadFolder={vi.fn()}
        onDropItemsToFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onSelectFolder={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Projects" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground"
    );
  });
});
