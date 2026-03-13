"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { FolderOptionsMenu } from "./folder-options-menu";
import {
  isStudioItemDrag,
  parseDraggedLibraryItemIds,
} from "../studio-drag-data";
import type { StudioFolder } from "../types";

interface FolderSidebarProps {
  folderCounts: Record<string, number>;
  folders: StudioFolder[];
  onCopyFolderId: (folderId: string) => void;
  onRequestDeleteFolder: (folderId: string) => void;
  selectedFolderId: string | null;
  onCreateFolder: () => void;
  onDownloadFolder: (folderId: string) => void;
  onDropItemsToFolder: (itemIds: string[], folderId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onSelectFolder: (folderId: string | null) => void;
}

interface FolderRowProps {
  active: boolean;
  hasItems: boolean;
  label: string;
  onCopyFolderId: () => void;
  onClick: () => void;
  onDownloadFolder: () => void;
  onOpenFolder: () => void;
  onDrop?: (itemIds: string[]) => void;
  onRequestDelete: () => void;
  onRename: () => void;
}

function FolderRow({
  active,
  hasItems,
  label,
  onCopyFolderId,
  onClick,
  onDownloadFolder,
  onOpenFolder,
  onDrop,
  onRequestDelete,
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
          "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 pr-12 text-left text-[15px] transition-all duration-150",
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

      <FolderOptionsMenu
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
        folderName={label}
        hasItems={hasItems}
        onCopyFolderId={onCopyFolderId}
        onDeleteFolder={onRequestDelete}
        onDownloadFolder={onDownloadFolder}
        onOpenFolder={onOpenFolder}
        onRenameFolder={onRename}
      />
    </div>
  );
}

export function FolderSidebar({
  folderCounts,
  folders,
  onCopyFolderId,
  onRequestDeleteFolder,
  selectedFolderId,
  onCreateFolder,
  onDownloadFolder,
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
              hasItems={(folderCounts[folder.id] ?? 0) > 0}
              label={folder.name}
              onCopyFolderId={() => onCopyFolderId(folder.id)}
              onClick={() =>
                onSelectFolder(selectedFolderId === folder.id ? null : folder.id)
              }
              onDownloadFolder={() => onDownloadFolder(folder.id)}
              onOpenFolder={() => onSelectFolder(folder.id)}
              onDrop={(itemIds) => onDropItemsToFolder(itemIds, folder.id)}
              onRequestDelete={() => onRequestDeleteFolder(folder.id)}
              onRename={() => onRenameFolder(folder.id)}
            />
          ))}
        </div>
      </div>

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
