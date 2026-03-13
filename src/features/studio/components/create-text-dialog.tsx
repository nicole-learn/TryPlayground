"use client";

import { ModalShell } from "./modal-shell";

interface CreateTextDialogProps {
  body: string;
  open: boolean;
  title: string;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
}

export function CreateTextDialog({
  body,
  open,
  title,
  onBodyChange,
  onClose,
  onSubmit,
  onTitleChange,
}: CreateTextDialogProps) {
  return (
    <ModalShell
      open={open}
      title="Create Text"
      onClose={onClose}
      panelClassName="h-[85vh] min-h-[30rem] max-h-[50rem] max-w-[72rem] overflow-hidden rounded-2xl"
      contentClassName="px-0 py-0"
      hideHeader
    >
      <form
        className="flex h-full flex-col overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Prompt"
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border/50 hover:bg-foreground/[0.02] focus:border-border/60 focus:bg-foreground/[0.02]"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Save Text
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
          <textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="Write the prompt body here."
            className="min-h-0 flex-1 resize-none rounded-xl border border-border/50 bg-foreground/[0.02] px-3 py-3 font-mono text-[13px] leading-6 text-foreground outline-none"
          />
        </div>
      </form>
    </ModalShell>
  );
}
