"use client";

import { Folder, FolderPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StudioFolder } from "../types";

interface FolderSidebarProps {
  allCount: number;
  folders: StudioFolder[];
  folderCounts: Record<string, number>;
  selectedFolderId: string | null;
  onCreateFolder: () => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
}

export function FolderSidebar({
  allCount,
  folders,
  folderCounts,
  selectedFolderId,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onSelectFolder,
}: FolderSidebarProps) {
  return (
    <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-4 flex items-center justify-between gap-3 px-2">
        <div>
          <div className="text-sm font-medium text-white">Folders</div>
          <p className="mt-1 text-xs text-white/44">
            Organize generations and uploads.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateFolder}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/78 transition hover:border-white/20 hover:text-white"
        >
          <FolderPlus className="size-3.5" />
          New
        </button>
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={cn(
            "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition",
            !selectedFolderId
              ? "border-cyan-300/40 bg-cyan-300/8"
              : "border-white/6 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]"
          )}
        >
          <span className="text-sm font-medium text-white">All Items</span>
          <span className="text-xs text-white/46">{allCount}</span>
        </button>

        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              className={cn(
                "rounded-2xl border px-3 py-3 transition",
                isSelected
                  ? "border-cyan-300/40 bg-cyan-300/8"
                  : "border-white/6 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Folder className="mt-0.5 size-4 shrink-0 text-white/46" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {folder.name}
                    </div>
                    <div className="mt-1 text-xs text-white/44">
                      {folderCounts[folder.id] ?? 0} items
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRenameFolder(folder.id)}
                    className="rounded-full p-2 text-white/44 transition hover:bg-white/[0.06] hover:text-white"
                    aria-label={`Rename ${folder.name}`}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteFolder(folder.id)}
                    className="rounded-full p-2 text-white/44 transition hover:bg-red-500/14 hover:text-red-200"
                    aria-label={`Delete ${folder.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
