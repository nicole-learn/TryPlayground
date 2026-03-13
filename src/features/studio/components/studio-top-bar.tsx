"use client";

import { Grid2x2, Grid3x3, Grid, KeyRound, Upload } from "lucide-react";
import { cn } from "@/lib/cn";

interface StudioTopBarProps {
  hasFalKey: boolean;
  gridDensity: number;
  onGridDensityChange: (density: number) => void;
  onOpenSettings: () => void;
  onOpenUpload: () => void;
}

const DENSITY_OPTIONS = [
  { value: 2, label: "Comfortable", icon: Grid2x2 },
  { value: 3, label: "Balanced", icon: Grid3x3 },
  { value: 4, label: "Compact", icon: Grid },
];

export function StudioTopBar({
  hasFalKey,
  gridDensity,
  onGridDensityChange,
  onOpenSettings,
  onOpenUpload,
}: StudioTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-white/8 bg-slate-950/80 px-5 py-4 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
            Studio
          </div>
          <div
            className={cn(
              "rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]",
              hasFalKey
                ? "bg-emerald-400/12 text-emerald-200"
                : "bg-amber-400/12 text-amber-200"
            )}
          >
            {hasFalKey ? "Fal Connected" : "Fal Key Missing"}
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Vyde Labs
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
          A Fal-powered workspace for text, image, and video generation with a
          folder-first library.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {DENSITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = gridDensity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onGridDensityChange(option.value)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-xs transition",
                  isActive
                    ? "bg-white text-slate-950"
                    : "text-white/62 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/78 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          <Upload className="size-4" />
          Upload
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
        >
          <KeyRound className="size-4" />
          Settings
        </button>
      </div>
    </header>
  );
}
