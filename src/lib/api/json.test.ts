import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the session module so we can exercise requireBearerSession without a
// real Supabase JWT. `vi.hoisted` makes the fn available inside the (hoisted)
// vi.mock factory without a top-level-variable reference error.
const { getSessionFromBearer } = vi.hoisted(() => ({ getSessionFromBearer: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionFromBearer }));

import {
  bearerToken,
  codeForError,
  jsonError,
  jsonOk,
  readJson,
  requireBearerSession,
  respondResult,
} from "./json";

function reqWithAuth(value?: string): Request {
  return new Request("https://example.com/api/v1/wb/wallet", {
    headers: value ? { Authorization: value } : {},
  });
}

describe("jsonOk", () => {
  it("wraps payload in { ok: true, data } with 200 by default", async () => {
    const res = jsonOk({ wagerId: 7 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { wagerId: 7 } });
  });

  it("honors a custom status", () => {
    expect(jsonOk({}, 201).status).toBe(201);
  });
});

describe("jsonError", () => {
  it("wraps code+message in { ok: false, error } with the code's canonical status", async () => {
    const res = jsonError("insufficient_funds", "Not enough WB.");
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "insufficient_funds", message: "Not enough WB." },
    });
  });

  it("maps each code to its documented HTTP status", () => {
    expect(jsonError("unauthorized", "x").status).toBe(401);
    expect(jsonError("forbidden", "x").status).toBe(403);
    expect(jsonError("validation", "x").status).toBe(400);
    expect(jsonError("not_found", "x").status).toBe(404);
    expect(jsonError("conflict", "x").status).toBe(409);
    expect(jsonError("rate_limited", "x").status).toBe(429);
    expect(jsonError("internal", "x").status).toBe(500);
  });

  it("allows a status override", () => {
    expect(jsonError("validation", "x", 422).status).toBe(422);
  });
});

describe("bearerToken", () => {
  it("extracts the token from a Bearer header (case-insensitive scheme)", () => {
    expect(bearerToken(reqWithAuth("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(bearerToken(reqWithAuth("bearer xyz"))).toBe("xyz");
  });

  it("returns null when missing or malformed", () => {
    expect(bearerToken(reqWithAuth())).toBeNull();
    expect(bearerToken(reqWithAuth("Basic abc"))).toBeNull();
    expect(bearerToken(reqWithAuth("Bearer"))).toBeNull();
  });
});

describe("requireBearerSession", () => {
  beforeEach(() => getSessionFromBearer.mockReset());

  it("returns a 401 envelope when no token is present", async () => {
    const result = await requireBearerSession(reqWithAuth());
    // NextResponse, not a Session
    expect(result).toHaveProperty("status", 401);
    expect(getSessionFromBearer).not.toHaveBeenCalled();
  });

  it("returns a 401 envelope when the token resolves to no session", async () => {
    getSessionFromBearer.mockResolvedValue(null);
    const result = await requireBearerSession(reqWithAuth("Bearer bad"));
    expect(result).toHaveProperty("status", 401);
    expect(await (result as Response).json()).toEqual({
      ok: false,
      error: { code: "unauthorized", message: "Invalid or expired token." },
    });
  });

  it("returns the Session when the token is valid", async () => {
    const session = { id: "u1", username: "alice", isAdmin: false };
    getSessionFromBearer.mockResolvedValue(session);
    const result = await requireBearerSession(reqWithAuth("Bearer good"));
    expect(result).toEqual(session);
    expect(getSessionFromBearer).toHaveBeenCalledWith("good");
  });
});

describe("readJson", () => {
  it("parses a valid JSON body", async () => {
    const req = new Request("https://x/y", { method: "POST", body: '{"a":1}' });
    expect(await readJson<{ a: number }>(req)).toEqual({ a: 1 });
  });

  it("returns null on malformed JSON", async () => {
    const req = new Request("https://x/y", { method: "POST", body: "not json" });
    expect(await readJson(req)).toBeNull();
  });
});

describe("codeForError", () => {
  it("infers codes from message phrases (caller phrases win)", () => {
    expect(codeForError("Insufficient funds.")).toBe("insufficient_funds");
    expect(codeForError("This event is closed.")).toBe("conflict");
    expect(codeForError("You are not entitled.")).toBe("not_entitled");
    expect(codeForError("League not found.")).toBe("not_found");
    expect(codeForError("No quote available.")).toBe("validation");
    expect(codeForError("Something odd")).toBe("validation");
    expect(codeForError("custom", [["custom", "rate_limited"]])).toBe("rate_limited");
  });
});

describe("respondResult", () => {
  it("maps ok results through toData into a 2xx envelope", async () => {
    const res = respondResult({ ok: true as const, wagerId: 9 }, (r) => ({ id: r.wagerId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: 9 } });
  });

  it("maps error results onto an inferred code", async () => {
    const res = respondResult(
      { ok: false as const, error: "Insufficient funds." },
      () => ({}),
    );
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "insufficient_funds", message: "Insufficient funds." },
    });
  });
});
