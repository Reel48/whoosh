/**
 * Generate the OpenAPI 3.1 spec for the v1 API from the TypeScript contracts.
 *
 *   npm run openapi:gen   →  writes openapi/whoosh-v1.yaml
 *
 * Single source of truth: schemas are derived from `src/lib/api/contracts.ts`
 * (via ts-json-schema-generator) and the route surface from
 * `src/lib/api/openapi/manifest.ts`. Re-run after changing either — the
 * staleness test (`manifest.test.ts`) fails CI if the committed spec drifts.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGenerator } from "ts-json-schema-generator";
import { stringify } from "yaml";
import {
  API_TITLE,
  API_VERSION,
  OPERATIONS,
  type ApiOperation,
} from "../src/lib/api/openapi/manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUTPUT_PATH = resolve(ROOT, "openapi/whoosh-v1.yaml");

// Canonical HTTP status per error code — mirrors STATUS_BY_CODE in src/lib/api/json.ts.
const STATUS_BY_CODE: Record<string, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  insufficient_funds: 402,
  not_entitled: 402,
  rate_limited: 429,
  internal: 500,
};
const ALL_CODES = Object.keys(STATUS_BY_CODE);

type JsonSchema = Record<string, unknown>;

/** Recursively rewrite `#/definitions/X` refs to `#/components/schemas/X`. */
function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "$ref" && typeof v === "string") {
        out[k] = v.replace("#/definitions/", "#/components/schemas/");
      } else {
        out[k] = rewriteRefs(v);
      }
    }
    return out;
  }
  return node;
}

/** Generate JSON Schema `definitions` for every exported type in contracts.ts. */
function buildSchemas(): Record<string, JsonSchema> {
  const generator = createGenerator({
    path: resolve(ROOT, "src/lib/api/contracts.ts"),
    tsconfig: resolve(ROOT, "tsconfig.json"),
    type: "*",
    skipTypeCheck: true,
    additionalProperties: true,
  });
  const schema = generator.createSchema("*") as { definitions?: Record<string, JsonSchema> };
  const defs = schema.definitions ?? {};
  return rewriteRefs(defs) as Record<string, JsonSchema>;
}

/** The `{ ok: true, data: <ref> }` success envelope for a response type. */
function successEnvelope(responseType: string): JsonSchema {
  return {
    type: "object",
    required: ["ok", "data"],
    properties: {
      ok: { type: "boolean", enum: [true] },
      data: { $ref: `#/components/schemas/${responseType}` },
    },
  };
}

/** Which error statuses an operation can produce. */
function errorStatuses(op: ApiOperation): number[] {
  const codes = new Set<string>(["validation", "internal"]);
  if (op.auth === "bearer") codes.add("unauthorized");
  if (op.capability) codes.add("forbidden");
  for (const c of op.extraErrors ?? []) codes.add(c);
  return [...new Set([...codes].map((c) => STATUS_BY_CODE[c]))].sort((a, b) => a - b);
}

function buildPaths(): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const parameters = [
      ...(op.pathParams ?? []).map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      ...(op.query ?? []).map((q) => ({
        name: q.name,
        in: "query",
        required: q.required,
        description: q.description,
        schema: { type: "string" },
      })),
    ];

    const responses: Record<string, unknown> = {
      "200": {
        description: "Success.",
        content: { "application/json": { schema: successEnvelope(op.responseType) } },
      },
    };
    for (const status of errorStatuses(op)) {
      responses[String(status)] = {
        description: "Error envelope.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
      };
    }

    const operation: Record<string, unknown> = {
      operationId: op.operationId,
      summary: op.summary,
      tags: [op.path.split("/")[3] ?? "v1"],
      security: op.auth === "bearer" ? [{ bearerAuth: [] }] : [],
      ...(parameters.length ? { parameters } : {}),
      responses,
    };
    if (op.requestType) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": { schema: { $ref: `#/components/schemas/${op.requestType}` } },
        },
      };
    }

    paths[op.path] ??= {};
    paths[op.path][op.method] = operation;
  }
  return paths;
}

export function buildOpenApiDoc(): unknown {
  const schemas = buildSchemas();
  schemas.ApiError = {
    type: "object",
    required: ["ok", "error"],
    properties: {
      ok: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: ALL_CODES },
          message: { type: "string" },
        },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: API_TITLE,
      version: API_VERSION,
      license: { name: "Proprietary", identifier: "LicenseRef-Proprietary" },
      description:
        "Client-agnostic JSON API for the Whoosh app (web + iOS). Every response " +
        "is a `{ ok, data }` / `{ ok, error }` envelope. Generated from " +
        "src/lib/api/contracts.ts — do not edit by hand (run `npm run openapi:gen`).",
    },
    // Relative URL: the API is served from the same origin as the deploying app.
    servers: [{ url: "/", description: "Same origin as the app deployment." }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas,
    },
    paths: buildPaths(),
    // The Apple IAP notification is a server-to-server callback, not a client
    // call — documented as a webhook, not a path.
    webhooks: {
      appleIapNotification: {
        post: {
          operationId: "appleIapNotification",
          summary: "App Store Server Notification V2 (Apple → backend).",
          // Authed by the payload's own JWS signature, not an API security scheme.
          security: [],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["signedPayload"],
                  properties: { signedPayload: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "Processed (or no-op)." } },
        },
      },
    },
  };
}

/** Serialize the doc to the exact YAML written to disk (used by the staleness test). */
export function serialize(doc: unknown): string {
  return stringify(doc, { sortMapEntries: false });
}

// Write only when run directly (`npm run openapi:gen`), not when imported by a test.
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isMain) {
  const doc = buildOpenApiDoc();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialize(doc));
  const schemaCount = Object.keys((doc as { components: { schemas: object } }).components.schemas).length;
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  ${OPERATIONS.length} operations, ${schemaCount} schemas.`);
}
