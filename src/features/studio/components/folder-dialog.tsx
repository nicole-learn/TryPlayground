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
  const title = mode === "create" ? "Create Folder" : "Rename Folder";
  const description =
    mode === "create"
      ? "Create a new folder to keep generations, uploads, and references organized."
      : "Update the folder name without changing the items inside it.";

  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onClose}
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
        <div className="px-6 py-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white">
              Folder name
            </span>
            <input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="Campaign concepts"
              className="h-10 w-full rounded-[8px] border-0 bg-foreground/5 px-3 text-[14px] font-medium text-foreground shadow-inner outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/60 focus:bg-foreground/10"
            />
          </label>

          {errorMessage ? (
            <p className="mt-3 text-left text-[12px] text-destructive">{errorMessage}</p>
          ) : null}
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
