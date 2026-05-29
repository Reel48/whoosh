"use client";

import { useRef, useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";

/**
 * Client-side wrapper around the Buy WB form. The actual submission still
 * posts to /api/wb/buy (which redirects to Stripe). We intercept submit on
 * amounts above $10 to show a branded ConfirmSheet so a misclicked $100
 * doesn't immediately launch Stripe checkout.
 */
export function BuyWbForm() {
  const [amount, setAmount] = useState("10");
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n > 10) {
      e.preventDefault();
      setConfirming(true);
    }
  }

  const wbAmount = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n * 10;
  })();

  return (
    <>
      <form
        ref={formRef}
        action="/api/wb/buy"
        method="POST"
        onSubmit={onSubmit}
        className="mt-5 flex flex-wrap items-stretch gap-3"
      >
        <div className="relative flex-1 min-w-[180px]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-bold text-ink/60">
            $
          </span>
          <input
            type="number"
            name="amount"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            inputMode="decimal"
            aria-label="USD amount"
            className="w-full rounded-full border-theme border-ink bg-surface px-4 py-3 pl-8 font-display text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
        <button
          type="submit"
          className="tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke"
        >
          Buy WB
        </button>
        {wbAmount != null && (
          <p className="basis-full text-xs font-medium text-ink/60">
            You&rsquo;ll get{" "}
            <span className="font-display font-black text-ink">
              $
              {wbAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>{" "}
            in Whoosh Bucks.
          </p>
        )}
      </form>

      <ConfirmSheet
        open={confirming}
        title={`Buy $${Number(amount).toFixed(2)} of Whoosh Bucks?`}
        body={
          <>
            <p>
              You&rsquo;ll be sent to Stripe to pay{" "}
              <strong className="font-display font-black text-ink">
                ${Number(amount).toFixed(2)} USD
              </strong>{" "}
              and receive{" "}
              <strong className="font-display font-black text-ink">
                $
                {(Number(amount) * 10).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                WB
              </strong>{" "}
              once the charge clears.
            </p>
          </>
        }
        confirmLabel="Continue to Stripe"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          formRef.current?.submit();
        }}
      />
    </>
  );
}
