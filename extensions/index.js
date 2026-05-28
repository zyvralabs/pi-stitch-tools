import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

// ── Constants ──────────────────────────────────────────────────────────────

const STITCH_URL = "https://stitch.googleapis.com/mcp";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 10_000;

// Environment variable names checked for the API key
const API_KEY_ENV_VARS = ["STITCH_API_KEY", "GOOGLE_STITCH_API_KEY"];

// Path to a plain-text file containing only the API key
const API_KEY_FILE_PATH = join(homedir(), ".pi", "stitch-api-key");

// ── Utility helpers ────────────────────────────────────────────────────────

function normalizeDescription(description) {
	return String(description || "Google Stitch tool")
		.trim()
		.replace(/\s+/g, " ");
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
 * Strips BOM, null bytes, and invisible characters from a string.
 * Also strips leading/trailing whitespace.
 */
function sanitizeKey(raw) {
	return raw
		.replace(/^\uFEFF/, "") // UTF-8 / UTF-16 BOM
		.replace(/\uFFFE/, "") // UTF-16 LE BOM
		.replace(/\u0000/g, "") // null bytes
		.replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width spaces
		.trim();
}

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
		const value = process.env[envKey];
		if (value) {
			const cleaned = sanitizeKey(value);
			if (cleaned) return cleaned;
		}
	}

	// 2. Plain-text key file
	try {
		const raw = await readFile(API_KEY_FILE_PATH, "utf8");
		const cleaned = sanitizeKey(raw);
		if (cleaned) return cleaned;
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

			const inline = args.find(
				(a) => typeof a === "string" && a.startsWith("--api-key="),
			);
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

/**
 * Returns true if the error is transient and worth retrying.
 * Retries on: network errors, 5xx server errors, 429 rate limits.
 * Does NOT retry on: 4xx client errors, JSON parse errors.
 */
function shouldRetry(error) {
	const message = error?.message || "";

	// Network-level failures
	if (
		error?.name === "TypeError" ||
		message.includes("fetch failed") ||
		message.includes("network") ||
		message.includes("ECONN") ||
		message.includes("ETIMEDOUT") ||
		message.includes("timeout") ||
		message.includes("timed out") ||
		message.includes("AbortError")
	) {
		return true;
	}

	// Server errors and rate limits
	const statusMatch = message.match(/Stitch request failed \((\d+)\)/);
	if (statusMatch) {
		const status = parseInt(statusMatch[1], 10);
		return status >= 500 || status === 429;
	}

	return false;
}

/**
 * Sleeps for `ms` milliseconds, optionally with jitter (±25%).
 */
function sleep(ms) {
	const jitter = ms * 0.25 * (Math.random() * 2 - 1);
	return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

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
	let lastError;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
				throw new Error(
					`Stitch request failed (${response.status}): ${message}`,
				);
			}

			if (payload?.error) {
				throw new Error(
					`Stitch error [${payload.error.code}]: ${payload.error.message}`,
				);
			}

			return payload?.result;
		} catch (error) {
			lastError = error;
			if (attempt < MAX_RETRIES && shouldRetry(error)) {
				const delay = Math.min(
					RETRY_BASE_DELAY_MS * 2 ** attempt,
					RETRY_MAX_DELAY_MS,
				);
				await sleep(delay);
				continue;
			}
			throw error;
		} finally {
			timeoutContext.cleanup();
		}
	}

	throw lastError;
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
		const executionMode = stitchTool?.annotations?.readOnlyHint
			? "parallel"
			: "sequential";

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

	// ── Convenience commands ────────────────────────────────────────────

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

	pi.registerCommand("stitch-projects", {
		description: "List your Google Stitch projects",
		handler: async (_args, ctx) => {
			try {
				const result = await stitchRequest(apiKey, "tools/call", {
					name: "list_projects",
					arguments: {},
				});
				const projects = result?.structuredContent?.projects || [];
				if (projects.length === 0) {
					ctx.ui.notify("No Stitch projects found.", "info");
					return;
				}
				const lines = projects.map(
					(p) => `${p.name} — ${p.title || "Untitled"}`,
				);
				ctx.ui.notify(
					`Stitch projects (${projects.length}):\n${lines.join("\n")}`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(`Failed to list projects: ${error.message}`, "error");
			}
		},
	});

	pi.registerCommand("stitch-new-screen", {
		description:
			"Generate a new Stitch screen from a description. Usage: /stitch-new-screen <project-id> <prompt>",
		handler: async (args, ctx) => {
			const input = (args || "").trim();
			if (!input) {
				ctx.ui.notify(
					"Usage: /stitch-new-screen <project-id> <prompt>\nExample: /stitch-new-screen 123456 A modern login page with email and password",
					"warn",
				);
				return;
			}

			const spaceIdx = input.indexOf(" ");
			if (spaceIdx === -1) {
				ctx.ui.notify(
					"Please provide both project ID and a prompt.\nUsage: /stitch-new-screen <project-id> <prompt>",
					"warn",
				);
				return;
			}

			const projectId = input.slice(0, spaceIdx);
			const prompt = input.slice(spaceIdx + 1);

			try {
				ctx.ui.notify("Generating screen (this may take a minute)...", "info");
				const result = await stitchRequest(apiKey, "tools/call", {
					name: "generate_screen_from_text",
					arguments: { projectId, prompt },
				});

				const content = result?.content;
				if (Array.isArray(content)) {
					const textParts = content
						.filter((c) => c.type === "text")
						.map((c) => c.text)
						.join("\n");
					ctx.ui.notify(
						`Screen generated!\n${textParts || "Check your Stitch project."}`,
						"info",
					);
				} else {
					ctx.ui.notify("Screen generated! Check your Stitch project.", "info");
				}
			} catch (error) {
				ctx.ui.notify(`Screen generation failed: ${error.message}`, "error");
			}
		},
	});

	pi.registerCommand("stitch-theme", {
		description:
			"List design systems for a Stitch project. Usage: /stitch-theme <project-id>",
		handler: async (args, ctx) => {
			const projectId = (args || "").trim();
			if (!projectId) {
				ctx.ui.notify(
					"Usage: /stitch-theme <project-id>\nExample: /stitch-theme 123456",
					"warn",
				);
				return;
			}

			try {
				const result = await stitchRequest(apiKey, "tools/call", {
					name: "list_design_systems",
					arguments: { projectId },
				});
				const systems = result?.structuredContent?.designSystems || [];
				if (systems.length === 0) {
					ctx.ui.notify(
						`No design systems found for project ${projectId}.`,
						"info",
					);
					return;
				}
				const lines = systems.map(
					(s) => `${s.name} — ${s.displayName || "Unnamed"}`,
				);
				ctx.ui.notify(
					`Design systems (${systems.length}):\n${lines.join("\n")}`,
					"info",
				);
			} catch (error) {
				ctx.ui.notify(
					`Failed to list design systems: ${error.message}`,
					"error",
				);
			}
		},
	});

	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setStatus("stitch-tools", `stitch: ${stitchTools.length} tools`);
	});
}
