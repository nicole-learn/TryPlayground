import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateTextDialog } from "./create-text-dialog";
import { FeedbackDialog } from "./feedback-dialog";
import { FolderDeleteDialog } from "./folder-delete-dialog";
import { FolderDialog } from "./folder-dialog";
import { HostedAuthDialog } from "./hosted-auth-dialog";
import { ModalShell } from "./modal-shell";
import { QueueLimitDialog } from "./queue-limit-dialog";
import { StudioMessageDialog } from "./studio-message-dialog";

describe("studio dialogs", () => {
  it("closes ModalShell on backdrop click and escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ModalShell open title="Demo" onClose={onClose}>
        <button type="button">Focusable</button>
      </ModalShell>
    );

    const dialog = screen.getByRole("dialog");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("submits feedback and focuses the textarea", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onMessageChange = vi.fn();

    render(
      <FeedbackDialog
        errorMessage={null}
        message="Great work"
        open
        pending={false}
        onClose={vi.fn()}
        onMessageChange={onMessageChange}
        onSubmit={onSubmit}
      />
    );

    const textarea = screen.getByPlaceholderText("Tell us what you think.");
    await waitFor(() => expect(textarea).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Leave Feedback" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits the create prompt dialog with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onBodyChange = vi.fn();

    render(
      <CreateTextDialog
        body="Prompt body"
        errorMessage={null}
        open
        saving={false}
        title="Prompt"
        onBodyChange={onBodyChange}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onTitleChange={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText("Write the prompt body here.");
    await user.click(textarea);
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits the folder dialog with Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FolderDialog
        errorMessage={null}
        mode="create"
        open
        saving={false}
        value="Ideas"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onValueChange={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Folder name"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("wires the smaller confirmation and auth dialogs", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onCloseMessage = vi.fn();
    const onContinue = vi.fn();
    const onCloseQueue = vi.fn();

    const { rerender } = render(
      <FolderDeleteDialog
        folderName="References"
        open
        onClose={vi.fn()}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <HostedAuthDialog
        errorMessage={null}
        open
        pending={false}
        onContinue={onContinue}
      />
    );
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    rerender(
      <QueueLimitDialog open onClose={onCloseQueue} />
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onCloseQueue).toHaveBeenCalledTimes(1);

    rerender(
      <StudioMessageDialog
        open
        title="Generation Error"
        message="Something went wrong."
        onClose={onCloseMessage}
      />
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onCloseMessage).toHaveBeenCalledTimes(1);
  });
});
