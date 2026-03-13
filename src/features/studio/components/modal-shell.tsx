"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  panelClassName?: string;
  contentClassName?: string;
  hideHeader?: boolean;
  children: ReactNode;
}

export function ModalShell({
  open,
  title,
  description,
  onClose,
  panelClassName,
  contentClassName,
  hideHeader = false,
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full max-w-xl rounded-[28px] border border-white/10 bg-background/90 shadow-2xl shadow-black/50 backdrop-blur-2xl",
          panelClassName
        )}
      >
        {!hideHeader ? (
          <div className="border-b border-white/8 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
            ) : null}
          </div>
        ) : null}
        <div className={cn("px-6 py-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
