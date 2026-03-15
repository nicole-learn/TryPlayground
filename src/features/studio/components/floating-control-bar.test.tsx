import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDraft } from "../studio-local-runtime-data";
import {
  STUDIO_MODEL_CATALOG,
  STUDIO_MODEL_SECTIONS,
} from "../studio-model-catalog";
import { FloatingControlBar } from "./floating-control-bar";

function getTextModel() {
  const textModel = STUDIO_MODEL_CATALOG.find((entry) => entry.kind === "text");
  if (!textModel) {
    throw new Error("Expected at least one text model.");
  }

  return textModel;
}

function renderFloatingControlBar(prompt = "", overrides?: { onSavePrompt?: () => void }) {
  const model = getTextModel();
  const draft = {
    ...createDraft(model),
    prompt,
  };

  return render(
    <FloatingControlBar
      draft={draft}
      getDropHint={() => ""}
      model={model}
      models={[model]}
      sections={STUDIO_MODEL_SECTIONS}
      selectedModelId={model.id}
      onAddReferences={vi.fn()}
      onDropLibraryItems={vi.fn(() => null)}
      onGenerate={vi.fn()}
      onRemoveReference={vi.fn()}
      onSavePrompt={overrides?.onSavePrompt ?? vi.fn()}
      savePromptPending={false}
      onClearStartFrame={vi.fn()}
      onClearEndFrame={vi.fn()}
      onSelectModel={vi.fn()}
      onSetStartFrame={vi.fn()}
      onSetEndFrame={vi.fn()}
      onSetVideoInputMode={vi.fn()}
      onUpdateDraft={vi.fn()}
      onDropLibraryItemsToStartFrame={vi.fn(() => null)}
      onDropLibraryItemsToEndFrame={vi.fn(() => null)}
    />
  );
}

describe("FloatingControlBar", () => {
  it("disables Save Prompt when the prompt is empty", () => {
    renderFloatingControlBar("");

    expect(screen.getByRole("button", { name: "Save Prompt" })).toBeDisabled();
  });

  it("calls onSavePrompt from the bottom pill row", async () => {
    const user = userEvent.setup();
    const onSavePrompt = vi.fn();

    renderFloatingControlBar("A foggy neon street at dawn", {
      onSavePrompt,
    });

    await user.click(screen.getByRole("button", { name: "Save Prompt" }));

    expect(onSavePrompt).toHaveBeenCalledTimes(1);
  });
});
