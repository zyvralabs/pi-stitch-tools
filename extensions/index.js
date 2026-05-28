import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// ── Constants ──────────────────────────────────────────────────────────────

const STITCH_URL = "https://stitch.googleapis.com/mcp";
const REQUEST_TIMEOUT_MS = 30_000;

// Environment variable names checked for the API key
const API_KEY_ENV_VARS = ["STITCH_API_KEY", "GOOGLE_STITCH_API_KEY"];

// Path to a plain-text file containing only the API key
const API_KEY_FILE_PATH = join(homedir(), ".pi", "stitch-api-key");

// ── Utility helpers ────────────────────────────────────────────────────────

function normalizeDescription(description) {
  return String(description || "Google Stitch tool").trim().replace(/\s+/g, " ");
}

function toPiToolName(stitchToolName) {
  return `stitch_${stitchToolName}`;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeInputSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {}, additionalProperties: true };
  }

  const normalized = cloneJson(schema);
  if (!normalized.type) normalized.type = "object";
  if (!normalized.properties) normalized.properties = {};
  if (!Array.isArray(normalized.required)) normalized.required = [];
  return normalized;
}

function normalizeToolContent(content) {
  if (!Array.isArray(content) || content.length === 0) {
    return [{ type: "text", text: "Tool completed without content." }];
  }

  return content.map((item) => {
    if (item?.type === "text" && typeof item.text === "string") {
      return { type: "text", text: item.text };
    }

    if (
      item?.type === "image" &&
      typeof item.data === "string" &&
      typeof item.mimeType === "string"
    ) {
      return { type: "image", data: item.data, mimeType: item.mimeType };
    }

    return { type: "text", text: JSON.stringify(item, null, 2) };
  });
}

// ── API key resolution ─────────────────────────────────────────────────────

/**
 * Resolves the Stitch API key by trying, in order:
 *   1. Environment variables: STITCH_API_KEY, GOOGLE_STITCH_API_KEY
 *   2. Plain-text file at ~/.pi/stitch-api-key
 *   3. Legacy mcp.json fallback (for users migrating from the local-package era)
 *
 * Returns the key string, or undefined if not found.
 */
async function resolveApiKey() {
  // 1. Environment variables
  for (const envKey of API_KEY_ENV_VARS) {
    const value = process.env[envKey]?.trim();
    if (value) return value;
  }

  // 2. Plain-text key file
  try {
    const raw = await readFile(API_KEY_FILE_PATH, "utf8");
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  } catch {
    // file does not exist — continue
  }

  // 3. Legacy ~/.pi/agent/mcp.json fallback
  try {
    const mcpConfigPath = join(homedir(), ".pi", "agent", "mcp.json");
    const raw = await readFile(mcpConfigPath, "utf8");
    const parsed = JSON.parse(raw);

    const headerKey = parsed?.mcpServers?.stitch?.headers?.["X-Goog-Api-Key"];
    if (typeof headerKey === "string" && headerKey.trim()) {
      return headerKey.trim();
    }

    const args = parsed?.mcpServers?.stitch?.args;
    if (Array.isArray(args)) {
      const flagIdx = args.indexOf("--api-key");
      const flagVal = flagIdx >= 0 ? args[flagIdx + 1] : undefined;
      if (typeof flagVal === "string" && flagVal.trim()) {
        return flagVal.trim();
      }

      const inline = args.find((a) => typeof a === "string" && a.startsWith("--api-key="));
      if (typeof inline === "string") {
        const inlineVal = inline.slice("--api-key=".length).trim();
        if (inlineVal) return inlineVal;
      }
    }
  } catch {
    // mcp.json unavailable — that's fine
  }

  return undefined;
}

// ── HTTP client ────────────────────────────────────────────────────────────

function createTimeoutContext(signal) {
  if (
    typeof AbortSignal?.timeout === "function" &&
    typeof AbortSignal?.any === "function"
  ) {
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return {
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
      cleanup() {},
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error("Stitch request timed out")),
    REQUEST_TIMEOUT_MS,
  );
  const abortFromParent = () => controller.abort(signal?.reason);

  if (signal) {
    if (signal.aborted) {
      abortFromParent();
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener?.("abort", abortFromParent);
    },
  };
}

async function stitchRequest(apiKey, method, params = {}, signal) {
  const timeoutContext = createTimeoutContext(signal);

  try {
    const response = await fetch(STITCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: timeoutContext.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from Stitch: ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const message = payload?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Stitch request failed (${response.status}): ${message}`);
    }

    if (payload?.error) {
      throw new Error(`Stitch error [${payload.error.code}]: ${payload.error.message}`);
    }

    return payload?.result;
  } finally {
    timeoutContext.cleanup();
  }
}

// ── Prompt snippet builder ─────────────────────────────────────────────────

function buildPromptSnippet(tool) {
  const desc = normalizeDescription(tool.description);
  return desc.length > 120 ? `${desc.slice(0, 117)}...` : desc;
}

// ── Extension entry point ──────────────────────────────────────────────────

export default async function stitchToolsExtension(pi) {
  const apiKey = await resolveApiKey();

  if (!apiKey) {
    // No key found — register a fallback command that tells the user how to set one up
    pi.registerCommand("stitch-status", {
      description: "Show Google Stitch extension status",
      handler: async (_args, ctx) => {
        ctx.ui.notify(
          [
            "Stitch API key not found.",
            "",
            "Pick one:",
            "  1. Set env var: STITCH_API_KEY=<your-key>",
            "  2. Save key to file: echo <your-key> > ~/.pi/stitch-api-key",
            "  3. Legacy: configure ~/.pi/agent/mcp.json stitch entry",
          ].join("\n"),
          "error",
        );
      },
    });
    return;
  }

  // Fetch available Stitch tools from the upstream server
  let stitchTools = [];
  try {
    const upstream = await stitchRequest(apiKey, "tools/list");
    stitchTools = Array.isArray(upstream?.tools) ? upstream.tools : [];
  } catch (error) {
    pi.registerCommand("stitch-status", {
      description: "Show Google Stitch extension status",
      handler: async (_args, ctx) => {
        ctx.ui.notify(`Stitch unavailable: ${error.message}`, "error");
      },
    });
    return;
  }

  // Register each Stitch tool as a native pi tool
  for (const stitchTool of stitchTools) {
    const piToolName = toPiToolName(stitchTool.name);
    const description = `Google Stitch — ${normalizeDescription(stitchTool.description)}`;
    const inputSchema = normalizeInputSchema(stitchTool.inputSchema);
    const executionMode = stitchTool?.annotations?.readOnlyHint ? "parallel" : "sequential";

    pi.registerTool({
      name: piToolName,
      label: piToolName,
      description,
      promptSnippet: buildPromptSnippet(stitchTool),
      parameters: inputSchema,
      executionMode,
      async execute(_toolCallId, params, signal) {
        try {
          const result = await stitchRequest(
            apiKey,
            "tools/call",
            {
              name: stitchTool.name,
              arguments: params || {},
            },
            signal,
          );

          return {
            isError: Boolean(result?.isError),
            content: normalizeToolContent(result?.content),
            details: {
              stitchTool: stitchTool.name,
              structuredContent: result?.structuredContent,
              meta: result?._meta,
            },
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              { type: "text", text: `Stitch tool failed: ${error.message}` },
            ],
            details: { stitchTool: stitchTool.name },
          };
        }
      },
    });
  }

  // Register convenience commands
  pi.registerCommand("stitch-status", {
    description: "Show loaded Google Stitch tools",
    handler: async (_args, ctx) => {
      const toolNames = stitchTools.map((t) => `stitch_${t.name}`).join(", ");
      ctx.ui.notify(
        `Stitch: ${stitchTools.length} tools loaded\n${toolNames}`,
        "info",
      );
    },
  });

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setStatus("stitch-tools", `stitch: ${stitchTools.length} tools`);
  });
}
