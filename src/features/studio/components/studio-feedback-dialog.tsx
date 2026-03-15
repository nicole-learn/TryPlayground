"use client";

import { Loader2 } from "lucide-react";
import { ModalShell } from "./modal-shell";

interface StudioFeedbackDialogProps {
  errorMessage: string | null;
  message: string;
  open: boolean;
  pending: boolean;
  successMessage: string | null;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
}

export function StudioFeedbackDialog({
  errorMessage,
  message,
  open,
  pending,
  successMessage,
  onClose,
  onMessageChange,
  onSubmit,
}: StudioFeedbackDialogProps) {
  return (
    <ModalShell
      open={open}
      title="Feedback"
      description="Tell me what is working, what is broken, or what you want improved."
      onClose={onClose}
      panelClassName="max-w-2xl rounded-[30px]"
    >
      <div className="space-y-5">
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Write your feedback here."
          disabled={pending}
          className="min-h-44 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-primary/40"
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/92">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-primary/18 bg-primary/10 px-4 py-3 text-sm text-primary-foreground">
            {successMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-medium text-white/76 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void onSubmit();
            }}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>{pending ? "Sending..." : "Send Feedback"}</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
