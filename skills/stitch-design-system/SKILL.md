---
name: stitch-design-system
description: Create, update, and apply Google Stitch design systems. Use when the user wants to set up a visual theme, change colors/fonts across screens, create a brand-consistent design system, or upload a DESIGN.md file.
license: MIT
metadata:
  package: pi-stitch-tools
  version: "1.0"
---

# Stitch — Design System

Manage design systems for consistent theming across Stitch screens.

## When to Use

- User says "create a theme", "set up design system", "apply branding"
- User wants to change colors, fonts, or styling across multiple screens
- User has a DESIGN.md file to upload
- User wants to standardize the look of a project

## Workflow: Create a new design system

### Step 1: Gather preferences

Clarify with the user (or infer from brand context):
- **Display name** — human-readable name (e.g., "Acme Brand Theme")
- **Color mode** — LIGHT or DARK
- **Primary color** — hex color (e.g., "#3B82F6" for blue)
- **Font family** — INTER (modern), SPACE_GROTESK (tech), SOURCE_SERIF_FOUR (editorial), PLAYFAIR_DISPLAY (elegant), MONTSERRAT (bold)
- **Roundness** — ROUND_FOUR, ROUND_EIGHT, ROUND_TWELVE, or ROUND_FULL

### Step 2: Create the design system

```text
stitch_create_design_system projectId="<project-id>" designSystem='{
  "displayName": "<name>",
  "theme": {
    "colorMode": "LIGHT",
    "headlineFont": "INTER",
    "bodyFont": "INTER",
    "roundness": "ROUND_EIGHT",
    "customColor": "#2563eb"
  }
}'
```

### Step 3: Note the asset ID

The response includes an asset ID (e.g., `assets/15996705518239280238`). Save this — you'll need it to apply the system to screens.

## Workflow: Update an existing design system

```text
stitch_update_design_system name="assets/<asset-id>" projectId="<project-id>" designSystem='{...}'
```

The full design system object is required, not just changed fields.

## Workflow: Apply a design system to screens

### Step 1: Get project details

```text
stitch_get_project name="projects/<project-id>"
```

Locate the `screenInstances` array — each instance has an `id` and `sourceScreen`.

### Step 2: List available design systems

```text
stitch_list_design_systems projectId="<project-id>"
```

### Step 3: Apply to screens

```text
stitch_apply_design_system projectId="<project-id>" assetId="<asset-id>" selectedScreenInstances='[{"id":"<instance-id>","sourceScreen":"projects/<project-id>/screens/<screen-id>"}]'
```

Apply to one screen or multiple screens at once.

## Workflow: Upload a DESIGN.md

If the user has a DESIGN.md file:

### Step 1: Read and encode the file

```bash
base64 -w 0 DESIGN.md
```

### Step 2: Upload

```text
stitch_upload_design_md projectId="<project-id>" designMdBase64="<base64-content>"
```

### Step 3: Create design system from it

```text
stitch_create_design_system_from_design_md projectId="<project-id>" selectedScreenInstance='{"id":"<instance-id>","sourceScreen":"projects/<project-id>/screens/<screen-id>"}'
```

## Font Reference

| Font | Vibe | Best for |
|------|------|----------|
| INTER | Modern, neutral | SaaS, dashboards, general UI |
| SPACE_GROTESK | Technical, geometric | Dev tools, tech products |
| PLUS_JAKARTA_SANS | Friendly, warm | Consumer apps, onboarding |
| SOURCE_SERIF_FOUR | Editorial, classic | Blogs, news, content-heavy |
| PLAYFAIR_DISPLAY | Elegant, luxury | Fashion, premium brands |
| MONTSERRAT | Bold, urban | Marketing, landing pages |
| IBM_PLEX_SANS | Corporate, reliable | Enterprise, data-heavy |
| GEIST | Minimal, Swiss | Clean portfolios, minimal UIs |
| JETBRAINS_MONO | Code, precise | Developer tools, documentation |

## Tips

- Create the design system **before** generating screens for visual consistency
- Apply the design system to all screens when changing branding
- Roundness affects the entire UI feel — ROUND_EIGHT is the safest default
- Always use `customColor` for brand identity; the dynamic variants are secondary
