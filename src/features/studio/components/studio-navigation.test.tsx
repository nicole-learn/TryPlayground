import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudioAccountButton } from "./studio-account-button";
import { StudioDevModeOverlay } from "./studio-dev-mode-overlay";
import { StudioMobileRail } from "./studio-mobile-rail";
import { StudioTopBar } from "./studio-top-bar";
import type { StudioFolder } from "../types";

const FOLDERS: StudioFolder[] = [
  {
    id: "folder-1",
    userId: "user-1",
    workspaceId: "workspace-1",
    name: "References",
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
    sortOrder: 0,
  },
];

describe("studio navigation surfaces", () => {
  it("renders top bar actions and selected-item controls", async () => {
    const user = userEvent.setup();
    const onClearSelection = vi.fn();
    const onDownloadSelected = vi.fn();
    const onDeleteSelected = vi.fn();

    render(
      <StudioTopBar
        appMode="hosted"
        accountLabel="N"
        hasFalKey={false}
        hostedAuthenticated
        onClearSelection={onClearSelection}
        onDeleteSelected={onDeleteSelected}
        onDownloadSelected={onDownloadSelected}
        onOpenCreateText={vi.fn()}
        onOpenAccount={vi.fn()}
        onOpenFeedback={vi.fn()}
        onOpenUpload={vi.fn()}
        onToggleSelectionMode={vi.fn()}
        selectedItemCount={2}
        selectionModeEnabled
        sizeLevel={3}
        onSizeLevelChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Clear selected assets" }));
    await user.click(screen.getByRole("button", { name: "Download selected" }));
    await user.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(onDownloadSelected).toHaveBeenCalledTimes(1);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it("renders the mobile rail feedback action and folder shortcuts", async () => {
    const user = userEvent.setup();
    const onOpenFeedback = vi.fn();
    const onSelectFolder = vi.fn();

    render(
      <StudioMobileRail
        appMode="local"
        accountLabel="T"
        folderCounts={{ "folder-1": 3 }}
        folders={FOLDERS}
        hasFalKey
        onClearSelection={vi.fn()}
        onDownloadSelected={vi.fn()}
        onDeleteSelected={vi.fn()}
        selectedFolderId={null}
        selectedItemCount={0}
        selectionModeEnabled={false}
        sizeLevel={2}
        onCreateFolder={vi.fn()}
        onOpenCreateText={vi.fn()}
        onOpenAccount={vi.fn()}
        onOpenFeedback={onOpenFeedback}
        onOpenUpload={vi.fn()}
        onSelectFolder={onSelectFolder}
        onSizeLevelChange={vi.fn()}
        onToggleSelectionMode={vi.fn()}
      />
    );

    await user.click(screen.getByTitle("References (3)"));
    await user.click(screen.getByRole("button", { name: "Feedback" }));

    expect(onSelectFolder).toHaveBeenCalledWith("folder-1");
    expect(onOpenFeedback).toHaveBeenCalledTimes(1);
  });

  it("switches modes from the dev mode overlay", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<StudioDevModeOverlay appMode="local" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Toggle dev mode switcher" }));
    await user.click(screen.getByRole("button", { name: /Hosted/i }));

    expect(onChange).toHaveBeenCalledWith("hosted");
  });

  it("renders account button states for local and hosted", () => {
    const { rerender } = render(
      <StudioAccountButton
        appMode="local"
        hasFalKey={false}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();

    rerender(
      <StudioAccountButton
        appMode="hosted"
        hasFalKey={false}
        hostedAuthenticated={false}
        hostedLabel="G"
        onClick={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Sign in with Google" })
    ).toBeInTheDocument();
  });
});
