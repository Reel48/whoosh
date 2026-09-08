"use client";

import { useActionState } from "react";
import { InviteLink } from "@/components/join/InviteLink";
import { CopyAllLinks } from "@/components/join/CopyAllLinks";
import { recoverPoolInvitesAction, type RecoverState } from "@/app/join/recover/actions";

const INITIAL: RecoverState = { status: "idle" };

/**
 * Email → invites lookup for buyers who lost the success page. Renders the
 * same invite cards as `/join/complete` so the recovered view is identical to
 * what they should have seen the first time.
 */
export function RecoverInvitesForm() {
  const [state, action, pending] = useActionState(recoverPoolInvitesAction, INITIAL);

  if (state.status === "found") {
    const many = state.invites.length > 1;
    return (
      <div>
        <p className="mb-6 text-center text-base font-medium text-ink/70">
          {many
            ? `Found ${state.invites.length} invites for that email. Tap each one to claim your spot.`
            : "Found your invite. Tap it to claim your spot on Sleeper."}
        </p>
        <div className="grid gap-6">
          {state.invites.map((i, idx) => (
            <InviteLink
              key={i.joinUrl}
              name={i.name}
              joinUrl={i.joinUrl}
              step={many ? `Invite ${idx + 1} of ${state.invites.length}` : undefined}
            />
          ))}
        </div>
        {many && <CopyAllLinks invites={state.invites} />}
      </div>
    );
  }

  return (
    <form action={action} className="rounded-3xl border-2 border-ink bg-white p-6 sm:p-8">
      <label className="block font-heading text-xl font-bold" htmlFor="recover-email">
        Email you paid with
      </label>
      <p className="mt-2 text-base font-medium text-ink/70">
        The one on your Stripe receipt. We&rsquo;ll show every invite that email has paid for.
      </p>
      <input
        id="recover-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        className="mt-4 w-full rounded-2xl border-2 border-ink bg-white-smoke px-4 py-3 text-base font-medium"
      />
      {state.status === "invalid" && (
        <p role="alert" className="mt-3 text-sm font-bold text-ink">
          That doesn&rsquo;t look like an email address.
        </p>
      )}
      {state.status === "none" && (
        <p role="alert" className="mt-3 text-sm font-bold text-ink">
          No paid entry found for that email. Double-check it against your Stripe receipt — if you
          just paid, give it a minute and try again.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-bold text-ink">
          Something went wrong on our end. Give it another shot in a moment.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full border-2 border-ink bg-ink px-7 py-3.5 text-base font-bold text-white-smoke transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Looking…" : "Show my invites"}
      </button>
    </form>
  );
}
