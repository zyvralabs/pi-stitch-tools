# Changelog

All notable changes to `@zyvra-labs/pi-stitch-tools` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-05-27

### Added

- **Retry logic** in `stitchRequest` — up to 3 retries with exponential backoff and jitter (±25%) on network errors, 5xx responses, and 429 rate limits.
- **Convenience commands:**
  - `/stitch-projects` — list all Stitch projects.
  - `/stitch-new-screen <projectId> <prompt>` — generate a screen from a text description.
  - `/stitch-theme <projectId>` — list design systems for a project.
- **Skills** (4 AI-guided workflows):
  - `stitch-new-project` — create and configure a new Stitch project.
  - `stitch-generate-screen` — generate UI screens from natural language.
  - `stitch-design-system` — create, update, and apply design systems.
  - `stitch-iterate` — edit screens, generate variants, and refine designs.
- **Skill registry** (`.atl/skill-registry.md`) for automatic skill-to-trigger matching.
- **Package image** (`screenshot.png`) displayed on the pi platform.
- **`.gitignore`** entries for `.pi/` (personal config) and `.atl/*` (runtime cache).

## [0.2.1] — 2026-05-27

### Fixed

- API key sanitization now strips BOM (`\uFEFF`, `\uFFFE`), null bytes (`\u0000`), and zero-width spaces — preventing cryptic auth failures from invisible characters in key strings.

## [0.2.0] — 2026-05-27

### Added

- Initial release. Dynamic registration of all Google Stitch MCP tools under the `stitch_` prefix.
- Multi-source API key resolution: environment variables, `~/.pi/stitch-api-key` file, and legacy `mcp.json` fallback.
- `/stitch-status` command to verify tool availability.
- Session status bar indicator showing loaded tool count.

[0.3.0]: https://github.com/zyvralabs/pi-stitch-tools/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/zyvralabs/pi-stitch-tools/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/zyvralabs/pi-stitch-tools/releases/tag/v0.2.0
