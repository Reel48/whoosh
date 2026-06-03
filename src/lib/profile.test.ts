import { describe, expect, it, vi, beforeEach } from "vitest";

// `profile.ts` imports "server-only" (a Next.js build guard) which has no
// resolvable module under vitest — stub it out.
vi.mock("server-only", () => ({}));

// Configurable service-client mock. Each builder method returns the builder;
// `maybeSingle()` resolves to `selectResult`, and awaiting the builder (the
// update path) resolves to `mutateResult`.
const state = vi.hoisted(() => ({
  selectResult: { data: null as unknown, error: null as unknown },
  mutateResult: { error: null as unknown },
}));
vi.mock("@/lib/supabase", () => {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "ilike", "limit", "neq", "update", "eq", "is"]) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(state.selectResult);
  builder.then = (res: (v: unknown) => unknown) => Promise.resolve(state.mutateResult).then(res);
  return { supabase: () => ({ from: () => builder }) };
});

import { HANDLE_RE, normalizeHandle, setUsername } from "./profile";

beforeEach(() => {
  state.selectResult = { data: null, error: null };
  state.mutateResult = { error: null };
});

describe("normalizeHandle", () => {
  it("lowercases, collapses separators to _, strips junk, caps at 20", () => {
    expect(normalizeHandle("Mason Jones")).toBe("mason_jones");
    expect(normalizeHandle("@Cool.Guy-99")).toBe("cool_guy_99");
    expect(normalizeHandle("a-b.c")).toBe("a_b_c"); // hyphen + dot → _
    expect(normalizeHandle("a b—c!!")).toBe("a_bc"); // em-dash/punct stripped, not separated
    expect(normalizeHandle("x".repeat(30))).toHaveLength(20);
  });
});

describe("HANDLE_RE", () => {
  it("accepts 3–20 [A-Za-z0-9_], rejects others", () => {
    expect(HANDLE_RE.test("mason_99")).toBe(true);
    expect(HANDLE_RE.test("ab")).toBe(false); // too short
    expect(HANDLE_RE.test("has space")).toBe(false);
    expect(HANDLE_RE.test("toolongusername_01234")).toBe(false); // 21 chars
  });
});

describe("setUsername", () => {
  it("rejects a bad format without touching the DB", async () => {
    const r = await setUsername("u1", "no");
    expect(r).toEqual({
      ok: false,
      code: "validation",
      error: expect.stringContaining("3–20 characters"),
    });
  });

  it("rejects a taken handle (availability check finds a row)", async () => {
    state.selectResult = { data: { user_id: "other" }, error: null };
    const r = await setUsername("u1", "taken_one");
    expect(r).toEqual({ ok: false, code: "conflict", error: "That handle is taken." });
  });

  it("succeeds when the handle is free", async () => {
    state.selectResult = { data: null, error: null }; // available
    state.mutateResult = { error: null }; // update ok
    expect(await setUsername("u1", "fresh_handle")).toEqual({ ok: true });
  });

  it("maps a unique-violation race (23505) to conflict", async () => {
    state.selectResult = { data: null, error: null }; // looked available...
    state.mutateResult = { error: { code: "23505", message: "duplicate key" } }; // ...lost the race
    const r = await setUsername("u1", "racy_handle");
    expect(r).toEqual({ ok: false, code: "conflict", error: "That handle is taken." });
  });
});
