"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import type { GenerationRun } from "../types";

interface RecentRunsListProps {
  runs: GenerationRun[];
  onReuseRun: (runId: string) => void;
}

export function RecentRunsList({ runs, onReuseRun }: RecentRunsListProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-cyan-300" />
        <h2 className="text-lg font-semibold text-white">Recent runs</h2>
      </div>

      <div className="mt-5 space-y-3">
        {runs.slice(0, 6).map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">
                  {run.modelName}
                </span>
                <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                  {run.status}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-white">
                {run.prompt}
              </p>
              <p className="mt-2 text-xs text-white/42">{run.summary}</p>
            </div>

            <button
              type="button"
              onClick={() => onReuseRun(run.id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72 transition hover:border-white/16 hover:text-white"
            >
              <RotateCcw className="size-4" />
              Reuse
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
