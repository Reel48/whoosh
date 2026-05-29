"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Bottom-sheet confirm modal. Replaces `window.confirm()` for any action
 * that benefits from a moment of "are you sure?" — Buy WB, sell position,
 * send transfer, etc.
 *
 * Bottom-anchored on mobile for thumb-reach; centered on sm+. Tap the
 * scrim to dismiss; Escape key dismisses.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onCancel}
        className="absolute inset-0 cursor-pointer bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-t-3xl border-2 border-ink bg-white-smoke p-6 pb-[max(env(safe-area-inset-bottom),24px)] shadow-2xl sm:rounded-3xl sm:pb-6">
        <h2 className="font-heading text-2xl font-black tracking-tight text-ink">
          {title}
        </h2>
        {body && (
          <div className="mt-3 text-sm font-medium leading-relaxed text-ink/80">
            {body}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="tap-press order-2 cursor-pointer rounded-full border-2 border-ink bg-white-smoke px-5 py-3 text-sm font-bold text-ink sm:order-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`tap-press order-1 cursor-pointer rounded-full border-2 border-ink px-5 py-3 text-sm font-bold sm:order-2 ${
              tone === "destructive"
                ? "bg-imperial-red text-white-smoke"
                : "bg-ink text-white-smoke"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
