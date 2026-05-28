# pi-stitch-tools

Google Stitch integration for pi — generate, edit, and manage UI designs directly from your coding session.

## What it does

Registers all [Google Stitch](https://stitch.withgoogle.com) tools as native pi tools under the `stitch_` prefix, so you can:

- List, get, and create Stitch projects
- List and get screens
- Generate screens from text prompts
- Edit existing screens
- Generate design variants
- Create and apply design systems
- Upload DESIGN.md files

## Install

```bash
pi install npm:@zyvra-labs/pi-stitch-tools
```

After installation, **restart pi** or run `/reload` to activate the tools.

## Setup — API Key

You need a Google Stitch API key. Pick one method:

### Option 1: Environment variable

```bash
export STITCH_API_KEY="your-key-here"
# or
export GOOGLE_STITCH_API_KEY="your-key-here"
```

### Option 2: File

```bash
echo "your-key-here" > ~/.pi/stitch-api-key
```

### Option 3: Legacy mcp.json (existing users)

If you already have Stitch configured in `~/.pi/agent/mcp.json` with the `X-Goog-Api-Key` header or `--api-key` flag, the extension will pick it up automatically.

Once the key is set, restart pi and run:

```
/stitch-status
```

If everything is working you'll see: `Stitch: 14 tools loaded`.

## Usage

All tools follow the `stitch_<upstream-name>` convention. Examples:

```
# List your projects
stitch_list_projects

# Get project details
stitch_get_project name=projects/14082150201392761251

# List screens in a project
stitch_list_screens projectId=14082150201392761251

# Generate a screen from text
stitch_generate_screen_from_text projectId=14082150201392761251 prompt="A login page with email and password fields"

# Create a design system
stitch_create_design_system projectId=14082150201392761251 designSystem='{"displayName":"My Theme","theme":{...}}'
```

> **Pro tip:** In pi, you don't need to construct the JSON by hand. Just describe what you want in natural language and pi will call the right tool with the right parameters.

## Convenience commands

Quick-access slash commands for common operations:

| Command | Usage |
|---------|-------|
| `/stitch-status` | Show loaded tools and API status |
| `/stitch-projects` | List your Stitch projects |
| `/stitch-new-screen <id> <prompt>` | Generate a screen from a description |
| `/stitch-theme <id>` | List design systems for a project |
| `/stitch-help` | Show all available Stitch commands |

## Available tools

The extension registers all tools advertised by the upstream Stitch MCP server. Run `/stitch-status` to see the full list.

Common tools include:

| Tool | Description |
|------|-------------|
| `stitch_list_projects` | List your Stitch projects |
| `stitch_get_project` | Get project details |
| `stitch_create_project` | Create a new project |
| `stitch_list_screens` | List screens in a project |
| `stitch_get_screen` | Get screen details |
| `stitch_generate_screen_from_text` | Generate a screen from a text prompt |
| `stitch_edit_screens` | Edit existing screens |
| `stitch_generate_variants` | Generate design variants |
| `stitch_create_design_system` | Create a design system |
| `stitch_update_design_system` | Update a design system |
| `stitch_apply_design_system` | Apply a design system to screens |
| `stitch_list_design_systems` | List design systems |
| `stitch_upload_design_md` | Upload a DESIGN.md file |
| `stitch_create_design_system_from_design_md` | Create design system from DESIGN.md |

## Troubleshooting

### "API key not found"

The extension cannot find your Stitch API key. Set one of:
- `STITCH_API_KEY` environment variable
- `GOOGLE_STITCH_API_KEY` environment variable
- `~/.pi/stitch-api-key` file (plain text, key only)

Then restart pi.

### "Stitch unavailable"

The extension could not reach the Stitch API server. Check your internet connection and verify your API key is valid.

### Tools don't show up

Run `/stitch-status` to check. If tools show as loaded but you can't use them, try restarting pi.

## How it works

The extension connects directly to the Google Stitch MCP endpoint (`stitch.googleapis.com/mcp`) over HTTP. It registers tools dynamically based on the upstream server's `tools/list` response, so you always have the latest tools without updating the package.

Key design decisions:
- **No MCP dependency**: Bypasses pi's MCP validation layer by using direct HTTP calls, avoiding an upstream schema issue.
- **Dynamic registration**: Tools are registered from `tools/list`, not hardcoded. New Stitch tools appear automatically.
- **Minimal dependencies**: Only uses Node.js built-ins (`fs/promises`, `os`, `path`). No npm dependencies needed.

## License

MIT — see [LICENSE](./LICENSE) file.

Changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/zyvralabs/pi-stitch-tools/issues).

---

Built by [zyvra-labs](https://github.com/zyvralabs).
