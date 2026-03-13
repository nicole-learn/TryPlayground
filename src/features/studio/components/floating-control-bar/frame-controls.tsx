"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { cn } from "@/lib/cn";
import { readDraggedLibraryItems } from "../../studio-drag-data";
import { getReferenceInputKindFromFile } from "../../studio-local-runtime-helpers";
import { useDragHoverReset } from "../../use-drag-hover-reset";
import type { DraftReference } from "../../types";

interface FrameSlotProps {
  frame: DraftReference | null;
  label: "Start" | "End";
  onAddFile: (file: File) => void;
  onDropLibraryItems: (itemIds: string[]) => Promise<string | null> | string | null;
  onPreview: (reference: DraftReference) => void;
  onRemove: () => void;
  onShowError: (message: string) => void;
}

export function FrameSlot({
  frame,
  label,
  onAddFile,
  onDropLibraryItems,
  onPreview,
  onRemove,
  onShowError,
}: FrameSlotProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useDragHoverReset({
    active: dragOver,
    containerRef,
    onReset: () => setDragOver(false),
  });

  const handleDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);

      const internalPayload = readDraggedLibraryItems(event.dataTransfer);
      if (internalPayload) {
        const message = await onDropLibraryItems(internalPayload.itemIds);
        if (message) {
          onShowError(message);
        }
        return;
      }

      const droppedFiles = Array.from(event.dataTransfer.files ?? []);
      const imageFile = droppedFiles.find(
        (file) => getReferenceInputKindFromFile(file) === "image"
      );

      if (!imageFile) {
        if (droppedFiles.length > 0) {
          onShowError(`Only image files can be used as a ${label.toLowerCase()} frame.`);
        }
        return;
      }

      onAddFile(imageFile);
    },
    [label, onAddFile, onDropLibraryItems, onShowError]
  );

  const handleClick = useCallback(() => {
    if (frame) {
      onPreview(frame);
      return;
    }

    inputRef.current?.click();
  }, [frame, onPreview]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative flex h-[70px] w-[70px] shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg text-muted-foreground transition-colors",
        frame
          ? dragOver
            ? "bg-primary/5 ring-2 ring-primary/30"
            : "bg-muted/60"
          : dragOver
            ? "border border-primary/60 bg-primary/10"
            : "border border-dashed border-border/70 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
      )}
      onClick={handleClick}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) {
          return;
        }
        setDragOver(false);
      }}
      onDrop={(event) => {
        void handleDrop(event);
      }}
    >
      {frame?.previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={frame.previewUrl}
            alt={`${label} frame`}
            className="size-full object-cover"
            draggable={false}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="absolute right-1 top-1 z-10 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
            aria-label={`Clear ${label.toLowerCase()} frame`}
          >
            <X className="size-2.5" />
          </button>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 py-px text-center text-[6px] font-semibold uppercase tracking-wider text-white/90">
            {label}
          </span>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 text-center">
          <Plus className="size-3.5" />
          <span className="text-[6px] font-semibold uppercase leading-tight tracking-wider">
            {label} Frame
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (nextFile && getReferenceInputKindFromFile(nextFile) === "image") {
            onAddFile(nextFile);
          } else if (nextFile) {
            onShowError(`Only image files can be used as a ${label.toLowerCase()} frame.`);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
