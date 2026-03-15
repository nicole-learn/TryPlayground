"use client";

import { Loader2 } from "lucide-react";
import { ModalShell } from "./modal-shell";

interface HostedAuthDialogProps {
  errorMessage: string | null;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onContinue: () => Promise<void> | void;
}

export function HostedAuthDialog({
  errorMessage,
  open,
  pending,
  onClose,
  onContinue,
}: HostedAuthDialogProps) {
  return (
    <ModalShell
      open={open}
      title="Sign in with Google"
      onClose={onClose}
      panelClassName="max-w-md rounded-[30px]"
    >
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => void onContinue()}
          disabled={pending}
          className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-full border border-white/12 bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/92 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>{pending ? "Redirecting..." : "Continue with Google"}</span>
        </button>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/92">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
