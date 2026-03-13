"use client";

import { Play } from "lucide-react";
import type { LibraryItem } from "../types";

interface StudioDragPreviewOverlayProps {
  preview: {
    count: number;
    itemIds: string[];
    leadItem: Pick<
      LibraryItem,
      "id" | "kind" | "title" | "previewUrl" | "contentText" | "prompt"
    >;
    x: number;
    y: number;
  } | null;
}

export function StudioDragPreviewOverlay({
  preview,
}: StudioDragPreviewOverlayProps) {
  if (!preview) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[95]"
      style={{
        transform: `translate3d(${preview.x + 14}px, ${preview.y + 14}px, 0)`,
      }}
    >
      <div className="relative">
        {preview.count > 1 ? (
          <>
            <div className="absolute left-1.5 top-1.5 size-[58px] rounded-2xl bg-black/48 shadow-[0_16px_28px_rgba(0,0,0,0.28)]" />
            <div className="absolute left-0.5 top-0.5 size-[58px] rounded-2xl bg-black/62 shadow-[0_20px_36px_rgba(0,0,0,0.34)]" />
          </>
        ) : null}

        <div className="relative size-[58px] overflow-hidden rounded-2xl border border-white/12 bg-neutral-950 shadow-[0_24px_48px_rgba(0,0,0,0.42)] ring-1 ring-white/5">
          {preview.leadItem.kind === "image" || preview.leadItem.kind === "video" ? (
            <>
              {preview.leadItem.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.leadItem.previewUrl}
                  alt={preview.leadItem.title}
                  className="size-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="size-full bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))]" />
              )}

              {preview.leadItem.kind === "video" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/16">
                  <span className="rounded-full bg-black/45 p-1.5 backdrop-blur-sm">
                    <Play className="size-4 text-white" />
                  </span>
                </div>
              ) : null}

              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.10)_55%,rgba(0,0,0,0.00)_100%)]" />
            </>
          ) : (
            <div className="flex size-full flex-col justify-between bg-[#f5f0e8] px-3 py-3 text-black">
              <div className="space-y-1.5">
                <span className="block h-1.5 w-8 rounded-full bg-black/12" />
                <span className="block h-1.5 w-10 rounded-full bg-black/16" />
                <span className="block h-1.5 w-6 rounded-full bg-black/12" />
              </div>
              <div className="line-clamp-2 text-[9px] font-medium leading-3 text-black/72">
                {preview.leadItem.contentText || preview.leadItem.prompt || preview.leadItem.title}
              </div>
            </div>
          )}

          {preview.count > 1 ? (
            <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_74%,black)] text-[10px] font-semibold text-primary-foreground shadow-[0_6px_16px_rgba(0,0,0,0.32)]">
              {preview.count}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
