import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadFilesDialog } from "./upload-files-dialog";
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

describe("UploadFilesDialog", () => {
  it("lets the user choose a folder and upload files", async () => {
    const user = userEvent.setup();
    const onChooseFiles = vi.fn();
    const onSelectFolder = vi.fn();

    const { container } = render(
      <UploadFilesDialog
        errorMessage={null}
        folders={FOLDERS}
        loading={false}
        open
        selectedFolderId={null}
        onChooseFiles={onChooseFiles}
        onClose={vi.fn()}
        onSelectFolder={onSelectFolder}
      />
    );

    await user.click(screen.getByRole("button", { name: "References" }));
    expect(onSelectFolder).toHaveBeenCalledWith("folder-1");

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const file = new File(["image"], "demo.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(onChooseFiles).toHaveBeenCalledWith([file]);
  });

  it("renders upload errors and respects the loading state", () => {
    render(
      <UploadFilesDialog
        errorMessage="Upload failed."
        folders={FOLDERS}
        loading
        open
        selectedFolderId={null}
        onChooseFiles={vi.fn()}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />
    );

    expect(screen.getByText("Upload failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
  });
});
