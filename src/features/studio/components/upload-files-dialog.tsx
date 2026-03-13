"use client";

import { useRef } from "react";
import type { StudioFolder } from "../types";
import { STUDIO_MEDIA_UPLOAD_ACCEPT } from "../studio-local-runtime-helpers";

interface UploadFilesDialogProps {
  folders: StudioFolder[];
  loading: boolean;
  open: boolean;
  selectedFolderId: string | null;
  onChooseFiles: (files: File[]) => void | Promise<void>;
  onClose: () => void;
  onToggleFolder: (folderId: string) => void;
}

export function UploadFilesDialog({
  folders,
  loading,
  open,
  selectedFolderId,
  onChooseFiles,
  onClose,
  onToggleFolder,
}: UploadFilesDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={STUDIO_MEDIA_UPLOAD_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length === 0) {
            return;
          }

          void onChooseFiles(files);
        }}
      />

      <div
        className="w-full max-w-[18rem] overflow-hidden rounded-2xl border border-white/10 bg-background/90 shadow-2xl backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Choose Files"}
          </button>
        </div>

        {folders.length > 0 ? (
          <div className="border-t border-white/10 px-5 py-3">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Add to folders
            </p>
            <div className="stable-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto">
              {folders.map((folder) => {
                const isChecked = selectedFolderId === folder.id;

                return (
                  <label
                    key={folder.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-foreground/80"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleFolder(folder.id)}
                      disabled={loading}
                      className="size-3.5 rounded border-border/60 accent-primary"
                    />
                    <span className="truncate">{folder.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex w-full items-center justify-center py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
