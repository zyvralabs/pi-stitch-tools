// Unit tests for pi-stitch-tools utility functions.
// Run: node --test test/unit.test.js
//
// Pure function implementations are duplicated here to keep them testable
// without extracting a shared module from the ESM-only extension.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Functions under test ───────────────────────────────────────────────────
// (mirrors extensions/index.js — kept in sync manually)

function sanitizeKey(raw) {
	return raw
		.replace(/^\uFEFF/, "")
		.replace(/\uFFFE/, "")
		.replace(/\u0000/g, "")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
		.trim();
}

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

function shouldRetry(error) {
	const message = error?.message || "";

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

	const statusMatch = message.match(/Stitch request failed \((\d+)\)/);
	if (statusMatch) {
		const status = parseInt(statusMatch[1], 10);
		return status >= 500 || status === 429;
	}

	return false;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("sanitizeKey", () => {
	it("returns a clean key unchanged", () => {
		assert.equal(sanitizeKey("abc123"), "abc123");
	});

	it("trims whitespace", () => {
		assert.equal(sanitizeKey("  key  "), "key");
	});

	it("strips UTF-8 BOM", () => {
		assert.equal(sanitizeKey("\uFEFFkey"), "key");
	});

	it("strips UTF-16 LE BOM", () => {
		assert.equal(sanitizeKey("\uFFFEkey"), "key");
	});

	it("strips null bytes", () => {
		assert.equal(sanitizeKey("ke\u0000y"), "key");
	});

	it("strips zero-width spaces", () => {
		assert.equal(sanitizeKey("\u200Bk\u200Ce\u200Dy"), "key");
	});

	it("handles empty string", () => {
		assert.equal(sanitizeKey(""), "");
	});

	it("handles multiple invisible chars combined", () => {
		assert.equal(sanitizeKey("\uFEFF \u200Bkey\u200D \u0000"), "key");
	});
});

describe("normalizeDescription", () => {
	it("trims and collapses whitespace", () => {
		assert.equal(normalizeDescription("  Hello   world  "), "Hello world");
	});

	it("falls back to default for empty input", () => {
		assert.equal(normalizeDescription(""), "Google Stitch tool");
	});

	it("falls back to default for null/undefined", () => {
		assert.equal(normalizeDescription(null), "Google Stitch tool");
		assert.equal(normalizeDescription(undefined), "Google Stitch tool");
	});

	it("replaces newlines and tabs with spaces", () => {
		assert.equal(
			normalizeDescription("Line1\nLine2\t\tLine3"),
			"Line1 Line2 Line3",
		);
	});
});

describe("toPiToolName", () => {
	it("prefixes with stitch_", () => {
		assert.equal(toPiToolName("list_projects"), "stitch_list_projects");
	});

	it("handles complex names", () => {
		assert.equal(
			toPiToolName("generate_screen_from_text"),
			"stitch_generate_screen_from_text",
		);
	});
});

describe("normalizeInputSchema", () => {
	it("returns default schema for null/undefined", () => {
		const result = normalizeInputSchema(null);
		assert.equal(result.type, "object");
		assert.deepEqual(result.properties, {});
		// required is only set for valid schema objects
	});

	it("returns default schema for non-object", () => {
		const result = normalizeInputSchema("string");
		assert.equal(result.type, "object");
		assert.deepEqual(result.properties, {});
	});

	it("adds missing type", () => {
		const result = normalizeInputSchema({ properties: { name: {} } });
		assert.equal(result.type, "object");
	});

	it("adds missing properties", () => {
		const result = normalizeInputSchema({ type: "object" });
		assert.deepEqual(result.properties, {});
	});

	it("adds missing required array", () => {
		const result = normalizeInputSchema({
			type: "object",
			properties: { x: {} },
		});
		assert.deepEqual(result.required, []);
	});

	it("does not mutate the original schema", () => {
		const original = { type: "object", properties: { x: { type: "string" } } };
		const result = normalizeInputSchema(original);
		result.properties.x.type = "number";
		assert.equal(original.properties.x.type, "string");
	});

	it("preserves existing required array", () => {
		const result = normalizeInputSchema({
			type: "object",
			properties: { a: {}, b: {} },
			required: ["a"],
		});
		assert.deepEqual(result.required, ["a"]);
	});
});

describe("normalizeToolContent", () => {
	it("returns fallback for empty array", () => {
		const result = normalizeToolContent([]);
		assert.equal(result.length, 1);
		assert.equal(result[0].type, "text");
		assert.equal(result[0].text, "Tool completed without content.");
	});

	it("returns fallback for null/undefined", () => {
		const result = normalizeToolContent(null);
		assert.equal(result.length, 1);
		assert.equal(result[0].text, "Tool completed without content.");
	});

	it("passes through valid text items", () => {
		const result = normalizeToolContent([{ type: "text", text: "hello" }]);
		assert.equal(result.length, 1);
		assert.equal(result[0].text, "hello");
	});

	it("passes through valid image items", () => {
		const result = normalizeToolContent([
			{ type: "image", data: "base64data", mimeType: "image/png" },
		]);
		assert.equal(result.length, 1);
		assert.equal(result[0].type, "image");
		assert.equal(result[0].mimeType, "image/png");
	});

	it("converts unknown items to JSON text", () => {
		const result = normalizeToolContent([{ foo: "bar" }]);
		assert.equal(result.length, 1);
		assert.equal(result[0].type, "text");
		assert.ok(result[0].text.includes('"foo"'));
	});

	it("handles mixed content", () => {
		const result = normalizeToolContent([
			{ type: "text", text: "a" },
			{ type: "image", data: "x", mimeType: "image/png" },
			{ unknown: true },
		]);
		assert.equal(result.length, 3);
		assert.equal(result[0].text, "a");
		assert.equal(result[1].type, "image");
		assert.equal(result[2].type, "text");
	});

	it("rejects image with missing mimeType", () => {
		const result = normalizeToolContent([{ type: "image", data: "base64" }]);
		assert.equal(result[0].type, "text"); // serialized as JSON
	});
});

describe("shouldRetry", () => {
	it("retries on TypeError (network failure)", () => {
		const err = new TypeError("fetch failed");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on ETIMEDOUT", () => {
		const err = new Error("ETIMEDOUT");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on AbortError", () => {
		const err = new Error("AbortError: request aborted");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on timeout", () => {
		const err = new Error("Stitch request timed out");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on 500 error", () => {
		const err = new Error("Stitch request failed (500): Internal Server Error");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on 503 error", () => {
		const err = new Error("Stitch request failed (503): Service Unavailable");
		assert.equal(shouldRetry(err), true);
	});

	it("retries on 429 rate limit", () => {
		const err = new Error("Stitch request failed (429): Too Many Requests");
		assert.equal(shouldRetry(err), true);
	});

	it("does NOT retry on 400 bad request", () => {
		const err = new Error("Stitch request failed (400): Bad Request");
		assert.equal(shouldRetry(err), false);
	});

	it("does NOT retry on 401 unauthorized", () => {
		const err = new Error("Stitch request failed (401): Unauthorized");
		assert.equal(shouldRetry(err), false);
	});

	it("does NOT retry on 404 not found", () => {
		const err = new Error("Stitch request failed (404): Not Found");
		assert.equal(shouldRetry(err), false);
	});

	it("does NOT retry on JSON parse errors", () => {
		const err = new Error("Invalid JSON from Stitch: {broken");
		assert.equal(shouldRetry(err), false);
	});

	it("does NOT retry on unknown errors", () => {
		const err = new Error("Something weird happened");
		assert.equal(shouldRetry(err), false);
	});

	it("handles errors without message", () => {
		const err = {};
		assert.equal(shouldRetry(err), false);
	});

	it("handles null/undefined error", () => {
		assert.equal(shouldRetry(null), false);
		assert.equal(shouldRetry(undefined), false);
	});
});
