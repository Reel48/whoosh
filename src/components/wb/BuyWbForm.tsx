"use client";

import { useRef, useState } from "react";
import { ConfirmSheet } from "@/components/ConfirmSheet";

/**
 * Client-side wrapper around the Buy WB form. Submission posts to /api/wb/buy
 * (which redirects to Stripe). Amounts above $10 show a ConfirmSheet first.
 * Styled with the Capital design system.
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
      <form ref={formRef} action="/api/wb/buy" method="POST" onSubmit={onSubmit} className="cap-buy cap-mt">
        <div className="input-group">
          <span className="addon">$</span>
          <input
            className="input input-num"
            type="number"
            name="amount"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            inputMode="decimal"
            aria-label="USD amount"
          />
        </div>
        <button type="submit" className="btn btn-primary">Buy WB</button>
        {wbAmount != null && (
          <p className="text-body-sm cap-buy__hint">
            You&rsquo;ll get{" "}
            <strong>
              ${wbAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>{" "}
            in Whoosh Bucks.
          </p>
        )}
      </form>

      <ConfirmSheet
        open={confirming}
        title={`Buy $${Number(amount).toFixed(2)} of Whoosh Bucks?`}
        body={
          <p>
            You&rsquo;ll be sent to Stripe to pay <strong>${Number(amount).toFixed(2)} USD</strong> and receive{" "}
            <strong>
              ${(Number(amount) * 10).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} WB
            </strong>{" "}
            once the charge clears.
          </p>
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
