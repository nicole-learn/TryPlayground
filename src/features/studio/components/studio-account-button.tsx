"use client";

interface StudioAccountButtonProps {
  hasFalKey: boolean;
  onClick: () => void;
}

export function StudioAccountButton({
  hasFalKey,
  onClick,
}: StudioAccountButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Provider settings"
      title="Provider settings"
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[color-mix(in_oklch,var(--primary)_25%,black)] text-[13px] font-semibold text-primary-foreground transition-all duration-150 hover:brightness-110 active:scale-[0.97]"
    >
      <span>V</span>
      <span
        className="absolute bottom-1 right-1 size-2 rounded-full border border-black/60"
        style={{
          background: hasFalKey ? "var(--primary)" : "oklch(0.8 0.18 85)",
        }}
      />
    </button>
  );
}
