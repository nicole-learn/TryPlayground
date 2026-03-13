"use client";

import { ArrowRight, AudioLines, ImageIcon, MessageSquareText, Sparkles, VideoIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReferenceDropzone } from "./reference-dropzone";
import type { StudioDraft, StudioModelDefinition } from "../types";

interface GenerationPanelProps {
  draft: StudioDraft;
  hasFalKey: boolean;
  model: StudioModelDefinition;
  onAddReferences: (files: File[]) => void;
  onGenerate: () => void;
  onRemoveReference: (referenceId: string) => void;
  onUpdateDraft: (patch: Partial<StudioDraft>) => void;
}

function Label({ children }: { children: string }) {
  return <label className="mb-2 block text-sm font-medium text-white">{children}</label>;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: Array<string | number>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <select
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
      >
        {options.map((option) => (
          <option key={String(option)} value={String(option)} className="bg-slate-950">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GenerationPanel({
  draft,
  hasFalKey,
  model,
  onAddReferences,
  onGenerate,
  onRemoveReference,
  onUpdateDraft,
}: GenerationPanelProps) {
  const canGenerate = draft.prompt.trim().length > 0 && hasFalKey;
  const kindIcon =
    model.kind === "image"
      ? ImageIcon
      : model.kind === "video"
        ? VideoIcon
        : MessageSquareText;
  const KindIcon = kindIcon;

  return (
    <section className="rounded-[32px] border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/8 p-5 sm:p-6">
        <div
          className={cn(
            "overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6",
            "relative"
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-100",
              model.heroGradient
            )}
          />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/72">
                  <KindIcon className="size-3.5" />
                  {model.providerLabel}
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                  {model.name}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/66">
                  {model.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {model.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-white/72"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-6">
        <div>
          <Label>Prompt</Label>
          <textarea
            value={draft.prompt}
            onChange={(event) => onUpdateDraft({ prompt: event.target.value })}
            placeholder={model.promptPlaceholder}
            className="min-h-36 w-full rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-400/60"
          />
        </div>

        {model.supportsNegativePrompt ? (
          <div>
            <Label>Negative prompt</Label>
            <textarea
              value={draft.negativePrompt}
              onChange={(event) =>
                onUpdateDraft({ negativePrompt: event.target.value })
              }
              placeholder="Describe what you want the model to avoid."
              className="min-h-28 w-full rounded-[24px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-cyan-400/60"
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {model.aspectRatioOptions ? (
            <SelectField
              label="Aspect ratio"
              value={draft.aspectRatio}
              options={model.aspectRatioOptions}
              onChange={(value) => onUpdateDraft({ aspectRatio: value })}
            />
          ) : null}

          {model.resolutionOptions ? (
            <SelectField
              label="Resolution"
              value={draft.resolution}
              options={model.resolutionOptions}
              onChange={(value) => onUpdateDraft({ resolution: value })}
            />
          ) : null}

          {model.kind === "image" && model.imageCountOptions ? (
            <SelectField
              label="Outputs"
              value={draft.imageCount}
              options={model.imageCountOptions}
              onChange={(value) => onUpdateDraft({ imageCount: Number(value) })}
            />
          ) : null}

          {model.kind === "video" && model.durationOptions ? (
            <SelectField
              label="Duration"
              value={draft.durationSeconds}
              options={model.durationOptions.map((option) => `${option}s`)}
              onChange={(value) =>
                onUpdateDraft({ durationSeconds: Number(value.replace("s", "")) })
              }
            />
          ) : null}

          {model.kind === "text" && model.toneOptions ? (
            <SelectField
              label="Tone"
              value={draft.tone}
              options={model.toneOptions}
              onChange={(value) => onUpdateDraft({ tone: value })}
            />
          ) : null}

          {model.kind === "text" && model.maxTokenOptions ? (
            <SelectField
              label="Max tokens"
              value={draft.maxTokens}
              options={model.maxTokenOptions}
              onChange={(value) => onUpdateDraft({ maxTokens: Number(value) })}
            />
          ) : null}
        </div>

        {model.kind === "video" ? (
          <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3">
            <button
              type="button"
              onClick={() => onUpdateDraft({ includeAudio: !draft.includeAudio })}
              className={cn(
                "inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm transition",
                draft.includeAudio
                  ? "bg-cyan-300 text-slate-950"
                  : "border border-white/10 text-white/62 hover:border-white/16 hover:text-white"
              )}
            >
              <AudioLines className="size-4" />
              Audio
            </button>
            <p className="text-sm text-white/48">
              Toggle generated audio for video-capable runs.
            </p>
          </div>
        ) : null}

        {model.supportsReferences ? (
          <ReferenceDropzone
            references={draft.references}
            onAddFiles={onAddReferences}
            onRemoveReference={onRemoveReference}
          />
        ) : null}

        <div className="flex flex-col gap-4 rounded-[26px] border border-white/10 bg-black/24 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="size-4 text-cyan-300" />
              Ready to generate
            </div>
            <p className="mt-2 text-sm leading-6 text-white/46">
              {hasFalKey
                ? "The UI is running on a mock runtime for now, but the state shape is ready for the real backend."
                : "Add a Fal API key in Settings before running generations."}
            </p>
          </div>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition",
              canGenerate
                ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                : "cursor-not-allowed bg-white/8 text-white/36"
            )}
          >
            Generate
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
