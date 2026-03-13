"use client";

import { FolderPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  isStudioItemDrag,
  parseDraggedLibraryItemIds,
} from "../studio-drag-data";
import type { StudioFolder } from "../types";

interface FolderSidebarProps {
  folders: StudioFolder[];
  selectedFolderCount: number;
  selectedFolderId: string | null;
  onCreateFolder: () => void;
  onDeleteFolder: (folderId: string) => void;
  onDropItemsToFolder: (itemIds: string[], folderId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
}

interface FolderRowProps {
  active: boolean;
  label: string;
  onClick: () => void;
  onDelete?: () => void;
  onDrop?: (itemIds: string[]) => void;
  onRename?: () => void;
}

function FolderRow({
  active,
  label,
  onClick,
  onDelete,
  onDrop,
  onRename,
}: FolderRowProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        onDragEnter={(event) => {
          if (!onDrop) return;
          if (!isStudioItemDrag(event.dataTransfer)) return;
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          if (!onDrop) return;
          if (!isStudioItemDrag(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          if (!dragOver) {
            setDragOver(true);
          }
        }}
        onDragLeave={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && event.currentTarget.contains(nextTarget)) return;
          setDragOver(false);
        }}
        onDrop={(event) => {
          if (!onDrop) return;
          event.preventDefault();
          setDragOver(false);
          onDrop(parseDraggedLibraryItemIds(event.dataTransfer));
        }}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-[15px] transition-all duration-150",
          active
            ? "bg-white/[0.11] font-medium text-foreground"
            : "bg-white/[0.05] text-foreground/84 hover:bg-white/[0.08] hover:text-foreground",
          dragOver
            ? "border border-primary/65 bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent)]"
            : "border border-transparent"
        )}
      >
        <span className="truncate">{label}</span>
      </button>

      {onRename || onDelete ? (
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {onRename ? (
            <button
              type="button"
              onClick={onRename}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
              aria-label={`Rename ${label}`}
              title="Rename folder"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-red-500/14 hover:text-red-200"
              aria-label={`Delete ${label}`}
              title="Delete folder"
            >
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FolderSidebar({
  folders,
  selectedFolderCount,
  selectedFolderId,
  onCreateFolder,
  onDeleteFolder,
  onDropItemsToFolder,
  onRenameFolder,
  onSelectFolder,
}: FolderSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-black px-2 pb-2 pt-3">
      <div className="stable-scrollbar flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2">
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              active={selectedFolderId === folder.id}
              label={folder.name}
              onClick={() =>
                onSelectFolder(selectedFolderId === folder.id ? null : folder.id)
              }
              onDelete={() => onDeleteFolder(folder.id)}
              onDrop={(itemIds) => onDropItemsToFolder(itemIds, folder.id)}
              onRename={() => onRenameFolder(folder.id)}
            />
          ))}
        </div>
      </div>

      {selectedFolderId ? (
        <div className="px-2 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Selected folder has {selectedFolderCount} item
          {selectedFolderCount === 1 ? "" : "s"}
        </div>
      ) : null}

      <div className="pt-2">
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/16 px-4 py-3 text-[15px] text-foreground/84 transition-colors hover:border-white/24 hover:bg-white/[0.04] hover:text-foreground"
        >
          <FolderPlus className="size-4" />
          <span>Add Folder</span>
        </button>
      </div>
    </aside>
  );
}
