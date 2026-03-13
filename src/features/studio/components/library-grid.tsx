"use client";

import { CopyPlus, File, Play, Trash2 } from "lucide-react";
import type { LibraryItem, StudioFolder } from "../types";

interface LibraryGridProps {
  density: number;
  folders: StudioFolder[];
  items: LibraryItem[];
  selectedFolderName: string | null;
  onDeleteItem: (itemId: string) => void;
  onReuseItem: (itemId: string) => void;
  onSetItemFolderIds: (itemId: string, folderIds: string[]) => void;
}

function columnsForDensity(density: number) {
  switch (density) {
    case 2:
      return "md:grid-cols-2 xl:grid-cols-2";
    case 4:
      return "md:grid-cols-2 xl:grid-cols-4";
    default:
      return "md:grid-cols-2 xl:grid-cols-3";
  }
}

export function LibraryGrid({
  density,
  folders,
  items,
  selectedFolderName,
  onDeleteItem,
  onReuseItem,
  onSetItemFolderIds,
}: LibraryGridProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {selectedFolderName ? selectedFolderName : "All items"}
          </h2>
          <p className="mt-1 text-sm text-white/46">
            {items.length} item{items.length === 1 ? "" : "s"} in view
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-white/12 bg-black/16 px-5 py-14 text-center text-sm leading-7 text-white/46">
          No items yet. Generate something or upload files to start building the
          folder-first workspace.
        </div>
      ) : (
        <div className={`mt-6 grid gap-4 ${columnsForDensity(density)}`}>
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-black/18"
            >
              <div className="relative">
                {item.kind === "image" && item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : item.kind === "video" && item.previewUrl ? (
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/12">
                      <div className="flex size-14 items-center justify-center rounded-full bg-white/16">
                        <Play className="ml-1 size-5 text-white" />
                      </div>
                    </div>
                  </div>
                ) : item.kind === "text" ? (
                  <div className="flex aspect-[4/3] items-start justify-start bg-[linear-gradient(135deg,rgba(99,102,241,0.24),rgba(17,24,39,0.24))] p-5">
                    <p className="line-clamp-6 text-sm leading-7 text-white/78">
                      {item.contentText}
                    </p>
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
                    <File className="size-8 text-white/52" />
                  </div>
                )}
              </div>

              <div className="space-y-3 px-4 py-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-medium text-white">
                      {item.title}
                    </h3>
                    <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/52">
                      {item.source}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/48">
                    {item.prompt || item.meta}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="text-xs text-white/36">{item.meta}</div>
                  {folders.length > 0 ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/34">
                        Folder
                      </span>
                      <select
                        value={item.folderIds[0] ?? ""}
                        onChange={(event) =>
                          onSetItemFolderIds(
                            item.id,
                            event.target.value ? [event.target.value] : []
                          )
                        }
                        className="w-full rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none transition focus:border-cyan-400/60"
                      >
                        <option value="" className="bg-slate-950">
                          No folder
                        </option>
                        {folders.map((folder) => (
                          <option
                            key={folder.id}
                            value={folder.id}
                            className="bg-slate-950"
                          >
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReuseItem(item.id)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/72 transition hover:border-white/16 hover:text-white"
                  >
                    <CopyPlus className="size-3.5" />
                    Reuse
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 p-2.5 text-white/52 transition hover:border-red-400/18 hover:text-red-200"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
