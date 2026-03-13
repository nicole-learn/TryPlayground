"use client";

import { ModalShell } from "./modal-shell";

interface FolderDeleteDialogProps {
  folderName: string;
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function FolderDeleteDialog({
  folderName,
  open,
  onClose,
  onDelete,
}: FolderDeleteDialogProps) {
  return (
    <ModalShell
      open={open}
      title="Delete folder?"
      onClose={onClose}
      hideHeader
      panelClassName="w-[min(92vw,21rem)] max-w-sm overflow-hidden rounded-3xl"
      contentClassName="px-0 py-0"
    >
      <div className="px-5 pb-5 pt-6 text-center">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          Delete folder?
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/62">
          This removes {folderName} from the workspace, but keeps its assets in
          your library.
        </p>
      </div>

      <div className="grid h-11 grid-cols-2 border-t border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center border-r border-white/10 text-[15px] text-foreground transition-colors hover:bg-foreground/5 active:bg-foreground/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center text-[15px] font-semibold text-red-300 transition-colors hover:bg-red-500/10 active:bg-red-500/14"
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}
