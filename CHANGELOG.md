# Changelog

All notable changes to `@zyvra-labs/pi-stitch-tools` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] — 2026-05-28

### Fixed

- **Timeout de 30s era insuficiente** para generación de screens. Las tools de generación (`generate_screen_from_text`, `edit_screens`, `generate_variants`, `create_design_system_from_design_md`) ahora tienen 180s de timeout. Las tools rápidas (`list_projects`, `get_screen`, etc.) mantienen 30s.
- **Retry en timeout empeoraba las cosas**: las gen tools ya no retryan en timeout (respeta el spec de Stitch "DO NOT RETRY"). Pero siguen retryando en errores de red transitorios (500, network blip).
- **Mensajes de error genéricos**: ahora detectan cuándo el timeout es por el parámetro `designSystem` y sugieren el workaround (generar sin design system → aplicar después).
- **`apply_design_system`** removido de la lista de tools lentas — es una operación rápida.

### Added

- **Skill `stitch-generate-screen`**: documentación del approach en dos pasos como método recomendado, más sección "Known Issues".
- **Hallazgo documentado**: `deviceType: "AGNOSTIC"` es más confiable que `"DESKTOP"` cuando Stitch está bajo carga.

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
