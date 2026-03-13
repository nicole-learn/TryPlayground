"use client";

import { Copy, Download, Play, Save, Trash2, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { LibraryItem } from "../types";

interface AssetDetailDialogProps {
  item: LibraryItem | null;
  open: boolean;
  onClose: () => void;
  onDelete: (itemId: string) => void;
  onDownload: (item: LibraryItem) => void;
  onReuse: (itemId: string) => void;
  onSaveText: (itemId: string, patch: { title?: string; contentText?: string }) => void;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isPlayableVideoUrl(url: string | null) {
  if (!url) return false;
  return url.startsWith("blob:") || url.startsWith("data:video");
}

export function AssetDetailDialog({
  item,
  open,
  onClose,
  onDelete,
  onDownload,
  onReuse,
  onSaveText,
}: AssetDetailDialogProps) {
  const [draftTitle, setDraftTitle] = useState(() => item?.title ?? "");
  const [draftBody, setDraftBody] = useState(() => item?.contentText ?? item?.prompt ?? "");
  const [copied, setCopied] = useState(false);

  const editableText = item?.kind === "text" && item.source === "uploaded";
  const createdLabel = item ? formatCreatedAt(item.createdAt) : "";
  const mediaPreview = useMemo(() => {
    if (!item || !item.previewUrl) return null;

    if (item.kind === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={item.title} className="max-h-[70vh] w-full object-contain" />
      );
    }

    if (item.kind === "video" && isPlayableVideoUrl(item.previewUrl)) {
      return (
        <video
          src={item.previewUrl}
          controls
          playsInline
          className="max-h-[70vh] w-full bg-black object-contain"
        />
      );
    }

    if (item.kind === "video") {
      return (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.previewUrl} alt={item.title} className="max-h-[70vh] w-full object-contain" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
              <Play className="size-6" />
            </span>
          </div>
        </div>
      );
    }

    return null;
  }, [item]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[min(1200px,calc(100vw-1rem))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-background/92 shadow-2xl backdrop-blur-2xl">
        <div className="flex shrink-0 items-center gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {item.kind} • {item.source}
            </p>
            <h2 className="truncate font-display text-[20px] font-semibold tracking-tight text-foreground">
              {item.title}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {item.meta} • {createdLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onReuse(item.id)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <WandSparkles className="size-3.5" />
              Reuse
            </button>
            <button
              type="button"
              onClick={() => onDownload(item)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-white/5"
            >
              <Download className="size-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="stable-scrollbar grid min-h-0 flex-1 gap-0 overflow-y-auto xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="min-h-0 bg-black/20 p-4">
            <div className="flex min-h-[20rem] items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-black/35">
              {item.kind === "text" ? (
                <div className="flex h-full min-h-[24rem] w-full flex-col bg-[#f5f0e8] p-8 text-black">
                  {editableText ? (
                    <>
                      <input
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-lg font-semibold outline-none"
                        placeholder="Text title"
                      />
                      <textarea
                        value={draftBody}
                        onChange={(event) => setDraftBody(event.target.value)}
                        className="mt-4 min-h-0 flex-1 resize-none rounded-xl border border-black/10 bg-black/[0.03] px-4 py-4 font-mono text-[13px] leading-6 outline-none"
                        placeholder="Write here"
                      />
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-semibold">{item.title}</div>
                      <pre className="mt-4 whitespace-pre-wrap font-mono text-[13px] leading-6 text-black/84">
                        {item.contentText || item.prompt || item.title}
                      </pre>
                    </>
                  )}
                </div>
              ) : (
                mediaPreview
              )}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-background/50 xl:border-l xl:border-t-0">
            <div className="space-y-4 px-5 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Prompt
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/88">
                  {item.prompt || "No prompt available for this asset."}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Details
                </p>
                <dl className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd className="text-right text-foreground">{item.kind}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="text-right text-foreground">{item.source}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="text-right text-foreground">{createdLabel}</dd>
                  </div>
                </dl>
              </div>

              {item.kind === "text" ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          draftBody || item.contentText || item.prompt || ""
                        );
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1200);
                      } catch {
                        setCopied(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-white/5"
                  >
                    <Copy className="size-3.5" />
                    {copied ? "Copied" : "Copy text"}
                  </button>
                  {editableText ? (
                    <button
                      type="button"
                      onClick={() =>
                        onSaveText(item.id, {
                          title: draftTitle,
                          contentText: draftBody,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
                    >
                      <Save className="size-3.5" />
                      Save changes
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-auto border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/25"
              >
                <Trash2 className="size-3.5" />
                Delete asset
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
