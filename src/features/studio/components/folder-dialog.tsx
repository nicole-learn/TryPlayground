"use client";

import { ModalShell } from "./modal-shell";

interface FolderDialogProps {
  errorMessage?: string | null;
  open: boolean;
  mode: "create" | "rename";
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function FolderDialog({
  errorMessage,
  open,
  mode,
  value,
  onValueChange,
  onClose,
  onSave,
}: FolderDialogProps) {
  const title = mode === "create" ? "New Folder" : "Rename Folder";

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      hideHeader
      panelClassName="w-[min(92vw,21rem)] max-w-sm overflow-hidden rounded-3xl"
      contentClassName="px-0 py-0"
    >
      <form
        className="space-y-0"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="px-5 pb-5 pt-6 text-center">
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <div className="mt-4 w-full space-y-3">
            <input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Folder name"
              autoFocus
              className="h-9 w-full rounded-[8px] border-0 bg-foreground/5 px-2.5 text-[14px] font-medium text-foreground shadow-inner outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/60 focus:bg-foreground/10"
            />

            {errorMessage ? (
              <p className="text-left text-[12px] text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </div>
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
            type="submit"
            className="flex items-center justify-center text-[15px] font-semibold text-primary transition-colors hover:bg-primary/5 active:bg-primary/10"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
