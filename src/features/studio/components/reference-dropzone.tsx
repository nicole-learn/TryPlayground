"use client";

import { ImagePlus, Paperclip, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { DraftReference } from "../types";

interface ReferenceDropzoneProps {
  references: DraftReference[];
  onAddFiles: (files: File[]) => void;
  onRemoveReference: (referenceId: string) => void;
}

export function ReferenceDropzone({
  references,
  onAddFiles,
  onRemoveReference,
}: ReferenceDropzoneProps) {
  const previewUrls = useMemo(
    () =>
      references.map((reference) => ({
        id: reference.id,
        file: reference.file,
        url: URL.createObjectURL(reference.file),
      })),
    [references]
  );

  useEffect(() => {
    return () => {
      for (const preview of previewUrls) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [previewUrls]);

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/12 bg-black/20 px-5 py-8 text-center transition hover:border-white/24 hover:bg-black/30">
        <div className="flex size-12 items-center justify-center rounded-full bg-cyan-300/12 text-cyan-200">
          <ImagePlus className="size-5" />
        </div>
        <div>
          <div className="text-sm font-medium text-white">Add references</div>
          <div className="mt-1 text-xs leading-5 text-white/46">
            Upload stills or frames to guide the result.
          </div>
        </div>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            onAddFiles(files);
            event.target.value = "";
          }}
        />
      </label>

      {previewUrls.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {previewUrls.map((reference) => (
            <div
              key={reference.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
                {reference.file.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reference.url}
                  alt={reference.file.name}
                  className="h-28 w-full object-cover"
                />
              ) : (
                <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,rgba(34,197,94,0.24),rgba(14,165,233,0.12))]">
                  <Paperclip className="size-6 text-white/68" />
                </div>
              )}
              <div className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {reference.file.name}
                  </div>
                  <div className="mt-1 text-xs text-white/46">
                    {(reference.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveReference(reference.id)}
                  className="rounded-full bg-white/8 p-2 text-white/58 transition hover:bg-white/12 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
