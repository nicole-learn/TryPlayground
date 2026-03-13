"use client";

import type { ReactNode } from "react";

interface ModalShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
}: ModalShellProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#12131c] shadow-2xl shadow-black/50">
        <div className="border-b border-white/8 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
          ) : null}
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
