"use client";

import {
  Eye,
  EyeOff,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { StudioAppMode } from "../studio-app-mode";
import {
  isStudioModelConfigurationEntryEnabled,
  STUDIO_MODEL_CONFIGURATION_ENTRIES,
} from "../studio-model-configuration";
import { ModalShell } from "./modal-shell";
import type {
  StudioCreditPurchaseAmount,
  StudioHostedAccount,
  StudioModelConfiguration,
  StudioProviderKeyId,
  StudioProviderSaveResult,
  StudioProviderSettings,
} from "../types";

type HostedSettingsTab = "credits" | "models" | "account";
type LocalSettingsTab = "api-key" | "models";

interface StudioSettingsDialogProps {
  accountActionErrorMessage: string | null;
  accountActionPending: "delete" | "sign_out" | null;
  appMode: StudioAppMode;
  hostedAccount: StudioHostedAccount | null;
  modelConfigurationErrorMessage: string | null;
  modelConfigurationPending: boolean;
  modelConfiguration: StudioModelConfiguration;
  open: boolean;
  purchaseErrorMessage: string | null;
  providerSettings: StudioProviderSettings;
  purchasePending: boolean;
  highlightedProviderKey: StudioProviderKeyId | null;
  onClose: () => void;
  onDeleteAccount: () => Promise<void> | void;
  onPurchaseCredits: (credits: StudioCreditPurchaseAmount) => Promise<void> | void;
  onSaveProviderSettings: (
    settings: StudioProviderSettings
  ) => Promise<StudioProviderSaveResult> | StudioProviderSaveResult;
  onSignOut: () => Promise<void> | void;
  onToggleModelEnabled: (modelId: string) => void;
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function SettingsTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-[0_8px_22px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
          : "bg-white/[0.04] text-white/68 hover:bg-white/[0.07] hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

function ApiKeyTab({
  initialValues,
  highlightedProviderKey,
  onSave,
}: {
  initialValues: StudioProviderSettings;
  highlightedProviderKey: StudioProviderKeyId | null;
  onSave: (
    settings: StudioProviderSettings
  ) => Promise<StudioProviderSaveResult> | StudioProviderSaveResult;
}) {
  const [falApiKey, setFalApiKey] = useState(initialValues.falApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(initialValues.openaiApiKey);
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialValues.anthropicApiKey);
  const [geminiApiKey, setGeminiApiKey] = useState(initialValues.geminiApiKey);
  const [revealedKeyId, setRevealedKeyId] = useState<StudioProviderKeyId | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const providerFields = [
    {
      id: "fal" as const,
      label: "Fal API Key",
      description: "Required for images, video, TTS, and background removal in local mode.",
      placeholder: "Paste your Fal API key",
      value: falApiKey ?? "",
      lastValidatedAt: initialValues.falLastValidatedAt,
      setValue: setFalApiKey,
    },
    {
      id: "openai" as const,
      label: "OpenAI API Key",
      description: "Required for ChatGPT models in local mode.",
      placeholder: "Paste your OpenAI API key",
      value: openaiApiKey ?? "",
      lastValidatedAt: initialValues.openaiLastValidatedAt,
      setValue: setOpenaiApiKey,
    },
    {
      id: "anthropic" as const,
      label: "Claude API Key",
      description: "Required for Claude models in local mode.",
      placeholder: "Paste your Claude API key",
      value: anthropicApiKey ?? "",
      lastValidatedAt: initialValues.anthropicLastValidatedAt,
      setValue: setAnthropicApiKey,
    },
    {
      id: "gemini" as const,
      label: "Gemini API Key",
      description: "Required for Gemini models in local mode.",
      placeholder: "Paste your Gemini API key",
      value: geminiApiKey ?? "",
      lastValidatedAt: initialValues.geminiLastValidatedAt,
      setValue: setGeminiApiKey,
    },
  ];

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const result = await onSave({
          falApiKey,
          falLastValidatedAt: initialValues.falLastValidatedAt,
          openaiApiKey,
          openaiLastValidatedAt: initialValues.openaiLastValidatedAt,
          anthropicApiKey,
          anthropicLastValidatedAt: initialValues.anthropicLastValidatedAt,
          geminiApiKey,
          geminiLastValidatedAt: initialValues.geminiLastValidatedAt,
        });

        setSaving(false);

        if (!result.ok) {
          setErrorMessage(result.errorMessage ?? "Could not save your API keys.");
          return;
        }

        setSuccessMessage(
          result.successMessage ?? "API keys connected for this browser session."
        );
      }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {providerFields.map((field) => {
          const status = field.value.trim()
            ? field.lastValidatedAt
              ? "Connected"
              : "Saved"
            : "Not Connected";
          const highlighted = highlightedProviderKey === field.id;
          const revealed = revealedKeyId === field.id;

          return (
            <div
              key={field.id}
              className={cn(
                "rounded-[28px] border bg-white/[0.03] p-5 transition",
                highlighted
                  ? "border-primary/45 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_55%,transparent),0_18px_42px_rgba(0,0,0,0.24)]"
                  : "border-white/8"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{field.label}</div>
                  <div className="mt-1 text-sm text-white/56">{field.description}</div>
                </div>
                <div
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    field.value.trim()
                      ? "bg-primary/15 text-primary"
                      : "bg-white/[0.05] text-white/50"
                  )}
                >
                  {status}
                </div>
              </div>

              <div
                className={cn(
                  "mt-4 flex items-center overflow-hidden rounded-2xl border bg-black/25 transition focus-within:border-primary/45",
                  highlighted ? "border-primary/38" : "border-white/10"
                )}
              >
                <input
                  name={`${field.id}ApiKey`}
                  type={revealed ? "text" : "password"}
                  value={field.value}
                  onChange={(event) => {
                    field.setValue(event.target.value);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRevealedKeyId((current) => (current === field.id ? null : field.id))
                  }
                  className="mr-2 inline-flex size-10 items-center justify-center rounded-full text-white/56 transition hover:bg-white/5 hover:text-white"
                  aria-label={revealed ? "Hide API key" : "Show API key"}
                >
                  {revealed ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        <div className="rounded-[28px] border border-white/8 bg-white/[0.025] px-5 py-4 text-sm leading-6 text-white/62 lg:col-span-2">
          Local mode stores these keys only for the current browser session. Hosted
          mode uses TryPlayground&apos;s server-managed provider keys.
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/90 lg:col-span-2">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-foreground lg:col-span-2">
            {successMessage}
          </div>
        ) : null}

        <div className="flex justify-end lg:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            <span>{saving ? "Checking..." : "Save API Keys"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}

function ModelConfigurationTab({
  errorMessage,
  modelConfiguration,
  pending,
  onToggleModelEnabled,
}: {
  errorMessage: string | null;
  modelConfiguration: StudioModelConfiguration;
  pending: boolean;
  onToggleModelEnabled: (modelId: string) => void;
}) {
  const [searchValue, setSearchValue] = useState("");
  const filteredEntries = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return STUDIO_MODEL_CONFIGURATION_ENTRIES;
    }

    return STUDIO_MODEL_CONFIGURATION_ENTRIES.filter((entry) =>
      entry.label.toLowerCase().includes(query)
    );
  }, [searchValue]);
  const enabledEntryCount = STUDIO_MODEL_CONFIGURATION_ENTRIES.filter((entry) =>
    isStudioModelConfigurationEntryEnabled({
      entryId: entry.id,
      enabledModelIds: modelConfiguration.enabledModelIds,
    })
  ).length;

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/34" />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search models"
          className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.035] pl-11 pr-4 text-sm text-white outline-none transition focus:border-primary/45"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredEntries.map((entry) => {
          const enabled = isStudioModelConfigurationEntryEnabled({
            entryId: entry.id,
            enabledModelIds: modelConfiguration.enabledModelIds,
          });
          const isLastEnabled = enabled && enabledEntryCount === 1;

          return (
            <button
              key={entry.id}
              type="button"
              disabled={isLastEnabled || pending}
              onClick={() => onToggleModelEnabled(entry.id)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
                enabled
                  ? "border-primary/45 bg-primary/12 text-primary"
                  : "border-white/10 bg-white/[0.03] text-white/78 hover:border-white/20 hover:bg-white/[0.05] hover:text-white",
                isLastEnabled || pending ? "cursor-not-allowed opacity-60" : ""
              )}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {pending ? (
        <div className="rounded-2xl border border-primary/18 bg-primary/10 px-4 py-3 text-sm text-primary-foreground">
          Saving model configuration...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/92">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

function CreditsTab({
  account,
  purchaseErrorMessage,
  purchasePending,
  onPurchaseCredits,
}: {
  account: StudioHostedAccount;
  purchaseErrorMessage: string | null;
  purchasePending: boolean;
  onPurchaseCredits: (credits: StudioCreditPurchaseAmount) => Promise<void> | void;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="text-[14px] uppercase tracking-[0.28em] text-white/34">
          Credits
        </div>
        <div className="mt-4 text-6xl font-semibold tracking-tight text-white">
          {formatCredits(account.creditBalance.balanceCredits)}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="min-w-[132px] rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-center text-2xl font-semibold text-white">
          100
        </div>

        <button
          type="button"
          onClick={() => void onPurchaseCredits(100)}
          disabled={purchasePending}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {purchasePending ? <Loader2 className="size-4 animate-spin" /> : null}
          <span>Buy</span>
        </button>
      </div>

      {purchaseErrorMessage ? (
        <div className="rounded-2xl border border-red-500/18 bg-red-500/10 px-4 py-3 text-sm text-red-100/90">
          {purchaseErrorMessage}
        </div>
      ) : null}
    </div>
  );
}

function AccountInformationTab({
  account,
  errorMessage,
  pendingAction,
  onDeleteAccount,
  onSignOut,
}: {
  account: StudioHostedAccount;
  errorMessage: string | null;
  pendingAction: "delete" | "sign_out" | null;
  onDeleteAccount: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
        <div className="text-lg font-semibold text-white">
          {account.profile.displayName}
        </div>
        <div className="mt-1 text-sm text-white/58">{account.profile.email}</div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-sm text-white/56">Queued</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {account.queuedCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-sm text-white/56">Generating</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {account.generatingCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-sm text-white/56">Completed</div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {account.completedCount}
          </div>
        </div>
      </div>

      {confirmingDelete ? (
        <div className="rounded-[28px] border border-red-500/18 bg-red-500/10 p-5">
          <div className="text-sm font-medium text-red-100">Delete account?</div>
          <div className="mt-2 text-sm leading-6 text-red-100/80">
            This removes your hosted account and its TryPlayground workspace data.
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={pendingAction !== null}
              className="rounded-full border border-white/12 px-5 py-2.5 text-sm font-medium text-white/76 transition hover:border-white/20 hover:text-white disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onDeleteAccount()}
              disabled={pendingAction !== null}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/28 px-5 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
            >
              {pendingAction === "delete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              <span>
                {pendingAction === "delete" ? "Deleting..." : "Delete Account"}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100/92">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={pendingAction !== null}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-sm font-medium text-white/76 transition hover:border-white/20 hover:text-white disabled:opacity-60"
        >
          {pendingAction === "sign_out" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          <span>{pendingAction === "sign_out" ? "Signing Out..." : "Sign Out"}</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={pendingAction !== null}
          hidden={confirmingDelete}
          className="rounded-full border border-red-500/28 px-5 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

export function StudioSettingsDialog({
  accountActionErrorMessage,
  accountActionPending,
  appMode,
  hostedAccount,
  modelConfigurationErrorMessage,
  modelConfigurationPending,
  modelConfiguration,
  open,
  purchaseErrorMessage,
  providerSettings,
  purchasePending,
  highlightedProviderKey,
  onClose,
  onDeleteAccount,
  onPurchaseCredits,
  onSaveProviderSettings,
  onSignOut,
  onToggleModelEnabled,
}: StudioSettingsDialogProps) {
  const [hostedTab, setHostedTab] = useState<HostedSettingsTab>("credits");
  const [localTab, setLocalTab] = useState<LocalSettingsTab>("api-key");

  const currentTab =
    appMode === "hosted" ? hostedTab : localTab;

  return (
    <ModalShell
      open={open}
      title="Settings"
      hideHeader
      panelClassName="flex h-[min(82vh,48rem)] max-w-[82rem] flex-col overflow-hidden rounded-[32px]"
      contentClassName="flex min-h-0 flex-1 flex-col p-0"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-white/8 pl-6 pr-4 pt-4 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="text-2xl font-semibold tracking-tight text-white">
                {appMode === "hosted" ? "Account" : "Provider Settings"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {appMode === "hosted" ? (
                  <>
                    <SettingsTabButton
                      active={currentTab === "credits"}
                      label="Credits"
                      onClick={() => setHostedTab("credits")}
                    />
                    <SettingsTabButton
                      active={currentTab === "models"}
                      label="Models"
                      onClick={() => setHostedTab("models")}
                    />
                    <SettingsTabButton
                      active={currentTab === "account"}
                      label="Account"
                      onClick={() => setHostedTab("account")}
                    />
                  </>
                ) : (
                  <>
                    <SettingsTabButton
                      active={currentTab === "api-key"}
                      label="API Key"
                      onClick={() => setLocalTab("api-key")}
                    />
                    <SettingsTabButton
                      active={currentTab === "models"}
                      label="Models"
                      onClick={() => setLocalTab("models")}
                    />
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-9 items-center justify-center self-start rounded-full border border-white/10 bg-white/[0.03] text-white/72 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              aria-label="Close settings"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {appMode === "hosted" ? (
            hostedTab === "credits" && hostedAccount ? (
              <CreditsTab
                account={hostedAccount}
                purchaseErrorMessage={purchaseErrorMessage}
                purchasePending={purchasePending}
                onPurchaseCredits={onPurchaseCredits}
              />
            ) : hostedTab === "models" ? (
              <ModelConfigurationTab
                errorMessage={modelConfigurationErrorMessage}
                modelConfiguration={modelConfiguration}
                pending={modelConfigurationPending}
                onToggleModelEnabled={onToggleModelEnabled}
              />
            ) : hostedAccount ? (
              <AccountInformationTab
                account={hostedAccount}
                errorMessage={accountActionErrorMessage}
                pendingAction={accountActionPending}
                onDeleteAccount={onDeleteAccount}
                onSignOut={onSignOut}
              />
            ) : null
          ) : localTab === "api-key" ? (
            <ApiKeyTab
              key={JSON.stringify({
                fal: providerSettings.falApiKey,
                falAt: providerSettings.falLastValidatedAt,
                openai: providerSettings.openaiApiKey,
                openaiAt: providerSettings.openaiLastValidatedAt,
                anthropic: providerSettings.anthropicApiKey,
                anthropicAt: providerSettings.anthropicLastValidatedAt,
                gemini: providerSettings.geminiApiKey,
                geminiAt: providerSettings.geminiLastValidatedAt,
                highlightedProviderKey,
              })}
              initialValues={providerSettings}
              highlightedProviderKey={highlightedProviderKey}
              onSave={onSaveProviderSettings}
            />
          ) : (
            <ModelConfigurationTab
              errorMessage={modelConfigurationErrorMessage}
              modelConfiguration={modelConfiguration}
              pending={modelConfigurationPending}
              onToggleModelEnabled={onToggleModelEnabled}
            />
          )}
        </div>
      </div>
    </ModalShell>
  );
}
