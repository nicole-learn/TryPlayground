import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDefaultStudioEnabledModelIds } from "../studio-model-configuration";
import { StudioSettingsDialog } from "./studio-settings-dialog";
import type {
  StudioHostedAccount,
  StudioModelConfiguration,
  StudioProviderSettings,
} from "../types";

function createHostedAccount(): StudioHostedAccount {
  return {
    profile: {
      id: "user-1",
      email: "nicole@tryplayground.ai",
      displayName: "Nicole",
      avatarLabel: "N",
      avatarUrl: null,
      preferences: {},
      createdAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:00:00.000Z",
    },
    creditBalance: {
      userId: "user-1",
      balanceCredits: 120,
      updatedAt: "2026-03-13T10:00:00.000Z",
    },
    activeCreditPack: {
      id: "pack-100",
      credits: 100,
      priceCents: 2500,
      currency: "usd",
      isActive: true,
      displayOrder: 0,
      createdAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:00:00.000Z",
    },
    queuedCount: 2,
    generatingCount: 1,
    completedCount: 9,
    pricingSummary: "Fal market rate + 15%",
    environmentLabel: "Hosted",
  };
}

const MODEL_CONFIGURATION: StudioModelConfiguration = {
  enabledModelIds: createDefaultStudioEnabledModelIds(),
  updatedAt: "2026-03-13T10:00:00.000Z",
};

const PROVIDER_SETTINGS: StudioProviderSettings = {
  falApiKey: "",
  lastValidatedAt: null,
};

describe("StudioSettingsDialog", () => {
  it("saves the local Fal API key", async () => {
    const user = userEvent.setup();
    const onSaveProviderSettings = vi
      .fn()
      .mockResolvedValue({ ok: true, successMessage: "Connected." });

    render(
      <StudioSettingsDialog
        accountActionErrorMessage={null}
        accountActionPending={null}
        appMode="local"
        hostedAccount={null}
        modelConfiguration={MODEL_CONFIGURATION}
        modelConfigurationErrorMessage={null}
        modelConfigurationPending={false}
        open
        purchaseErrorMessage={null}
        providerConnectionStatus="idle"
        providerSettings={PROVIDER_SETTINGS}
        purchasePending={false}
        onClose={vi.fn()}
        onDeleteAccount={vi.fn()}
        onPurchaseCredits={vi.fn()}
        onSaveProviderSettings={onSaveProviderSettings}
        onSignOut={vi.fn()}
        onToggleModelEnabled={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Paste your Fal API key"), "fal_test_key_123456789");
    await user.click(screen.getByRole("button", { name: "Save API Key" }));

    expect(onSaveProviderSettings).toHaveBeenCalledWith({
      falApiKey: "fal_test_key_123456789",
      lastValidatedAt: null,
    });
    expect(await screen.findByText("Connected.")).toBeInTheDocument();
  });

  it("toggles models from the hosted model configuration tab", async () => {
    const user = userEvent.setup();
    const onToggleModelEnabled = vi.fn();

    render(
      <StudioSettingsDialog
        accountActionErrorMessage={null}
        accountActionPending={null}
        appMode="hosted"
        hostedAccount={createHostedAccount()}
        modelConfiguration={MODEL_CONFIGURATION}
        modelConfigurationErrorMessage={null}
        modelConfigurationPending={false}
        open
        purchaseErrorMessage={null}
        providerConnectionStatus="idle"
        providerSettings={PROVIDER_SETTINGS}
        purchasePending={false}
        onClose={vi.fn()}
        onDeleteAccount={vi.fn()}
        onPurchaseCredits={vi.fn()}
        onSaveProviderSettings={vi.fn()}
        onSignOut={vi.fn()}
        onToggleModelEnabled={onToggleModelEnabled}
      />
    );

    await user.click(screen.getByRole("button", { name: "Model Configurations" }));
    await user.click(screen.getByRole("button", { name: "Nano Banana 2" }));

    expect(onToggleModelEnabled).toHaveBeenCalledWith("nano-banana-2");
  });

  it("starts the hosted credit purchase flow from the credits tab", async () => {
    const user = userEvent.setup();
    const onPurchaseCredits = vi.fn();

    render(
      <StudioSettingsDialog
        accountActionErrorMessage={null}
        accountActionPending={null}
        appMode="hosted"
        hostedAccount={createHostedAccount()}
        modelConfiguration={MODEL_CONFIGURATION}
        modelConfigurationErrorMessage={null}
        modelConfigurationPending={false}
        open
        purchaseErrorMessage={null}
        providerConnectionStatus="idle"
        providerSettings={PROVIDER_SETTINGS}
        purchasePending={false}
        onClose={vi.fn()}
        onDeleteAccount={vi.fn()}
        onPurchaseCredits={onPurchaseCredits}
        onSaveProviderSettings={vi.fn()}
        onSignOut={vi.fn()}
        onToggleModelEnabled={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Buy" }));
    expect(onPurchaseCredits).toHaveBeenCalledWith(100);
  });

  it("requires explicit delete confirmation in the hosted account tab", async () => {
    const user = userEvent.setup();
    const onDeleteAccount = vi.fn();
    const onSignOut = vi.fn();

    render(
      <StudioSettingsDialog
        accountActionErrorMessage={null}
        accountActionPending={null}
        appMode="hosted"
        hostedAccount={createHostedAccount()}
        modelConfiguration={MODEL_CONFIGURATION}
        modelConfigurationErrorMessage={null}
        modelConfigurationPending={false}
        open
        purchaseErrorMessage={null}
        providerConnectionStatus="idle"
        providerSettings={PROVIDER_SETTINGS}
        purchasePending={false}
        onClose={vi.fn()}
        onDeleteAccount={onDeleteAccount}
        onPurchaseCredits={vi.fn()}
        onSaveProviderSettings={vi.fn()}
        onSignOut={onSignOut}
        onToggleModelEnabled={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Account Information" }));
    await user.click(screen.getByRole("button", { name: "Delete Account" }));

    expect(screen.getByText(/removes your hosted account/i)).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "Delete Account" }).at(-1) as HTMLButtonElement
    );

    expect(onDeleteAccount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
