"use client";

import { ModalShell } from "./modal-shell";

interface StudioMessageDialogProps {
  open: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export function StudioMessageDialog({
  open,
  title,
  message,
  buttonLabel = "Close",
  onClose,
}: StudioMessageDialogProps) {
  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      panelClassName="max-w-md rounded-[28px]"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-white/72">{message}</p>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
