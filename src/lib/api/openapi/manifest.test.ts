import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { OPERATIONS } from "./manifest";
import {
  OUTPUT_PATH,
  buildOpenApiDoc,
  serialize,
} from "../../../../scripts/generate-openapi.mts";

const ROOT = resolve(__dirname, "../../../..");
const V1_DIR = resolve(ROOT, "src/app/api/v1");
const CONTRACTS = resolve(ROOT, "src/lib/api/contracts.ts");

// The IAP webhook is Apple→backend, intentionally absent from the client manifest.
const EXCLUDED_PATHS = new Set(["/api/v1/iap/apple/notify"]);

/** Walk src/app/api/v1 for route.ts files and read off their (method, path). */
function routeFileOperations(): Set<string> {
  const ops = new Set<string>();
  const files = readdirSync(V1_DIR, { recursive: true, encoding: "utf8" }).filter((f) =>
    f.endsWith("route.ts"),
  );
  for (const rel of files) {
    const abs = resolve(V1_DIR, rel);
    // .../api/v1/wb/wager/route.ts → /api/v1/wb/wager, with [x] → {x}.
    const path = ("/api/v1/" + rel)
      .replace(/\/route\.ts$/, "")
      .replace(/\[([^\]]+)\]/g, "{$1}");
    if (EXCLUDED_PATHS.has(path)) continue;
    const src = readFileSync(abs, "utf8");
    if (/export\s+async\s+function\s+GET\b/.test(src)) ops.add(`get ${path}`);
    if (/export\s+async\s+function\s+POST\b/.test(src)) ops.add(`post ${path}`);
  }
  return ops;
}

function manifestOperations(): Set<string> {
  return new Set(OPERATIONS.map((o) => `${o.method} ${o.path}`));
}

function exportedContractTypes(): Set<string> {
  const src = readFileSync(CONTRACTS, "utf8");
  const names = new Set<string>();
  for (const m of src.matchAll(/export type (\w+)/g)) names.add(m[1]);
  return names;
}

describe("openapi manifest ↔ routes parity", () => {
  it("has exactly one manifest entry per route handler (and vice versa)", () => {
    const fromFiles = routeFileOperations();
    const fromManifest = manifestOperations();
    const missingFromManifest = [...fromFiles].filter((o) => !fromManifest.has(o));
    const missingFromRoutes = [...fromManifest].filter((o) => !fromFiles.has(o));
    expect({ missingFromManifest, missingFromRoutes }).toEqual({
      missingFromManifest: [],
      missingFromRoutes: [],
    });
  });

  it("references only request/response types that exist in contracts.ts", () => {
    const types = exportedContractTypes();
    const unknown: string[] = [];
    for (const op of OPERATIONS) {
      if (op.requestType && !types.has(op.requestType)) unknown.push(op.requestType);
      if (!types.has(op.responseType)) unknown.push(op.responseType);
    }
    expect(unknown).toEqual([]);
  });
});

describe("openapi spec freshness", () => {
  it("committed openapi/whoosh-v1.yaml matches a fresh generation", () => {
    const committed = readFileSync(OUTPUT_PATH, "utf8");
    const fresh = serialize(buildOpenApiDoc());
    expect(fresh).toBe(committed);
  }, 30_000);
});
