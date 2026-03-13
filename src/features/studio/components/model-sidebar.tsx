"use client";

import { ImageIcon, MessageSquareText, Sparkles, VideoIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StudioModelDefinition, StudioModelSection } from "../types";

const SECTION_ICONS: Record<StudioModelSection, typeof ImageIcon> = {
  images: ImageIcon,
  videos: VideoIcon,
  text: MessageSquareText,
};

interface ModelSidebarProps {
  models: StudioModelDefinition[];
  sections: ReadonlyArray<{
    id: StudioModelSection;
    title: string;
    description: string;
  }>;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSidebar({
  models,
  sections,
  selectedModelId,
  onSelectModel,
}: ModelSidebarProps) {
  return (
    <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Sparkles className="size-4 text-cyan-300" />
        <span className="text-sm font-medium text-white">Models</span>
      </div>

      <div className="space-y-5">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.id];
          const sectionModels = models.filter((model) => model.section === section.id);

          return (
            <section key={section.id}>
              <div className="mb-2 px-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/42">
                  <Icon className="size-3.5" />
                  {section.title}
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  {section.description}
                </p>
              </div>

              <div className="space-y-1.5">
                {sectionModels.map((model) => {
                  const isSelected = model.id === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => onSelectModel(model.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        isSelected
                          ? "border-cyan-300/40 bg-cyan-300/8"
                          : "border-white/6 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">
                            {model.name}
                          </div>
                          <div className="mt-1 text-xs text-white/44">
                            {model.providerLabel}
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="rounded-full bg-cyan-300 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-950">
                            Active
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
