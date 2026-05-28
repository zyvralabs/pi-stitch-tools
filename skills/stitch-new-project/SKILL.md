---
name: stitch-new-project
description: Create a new Google Stitch project and set it up with a design system. Use when the user wants to start a new UI design project, set up a Stitch workspace, or bootstrap a design-to-code workflow.
license: MIT
metadata:
  package: pi-stitch-tools
  version: "1.0"
---

# Stitch — New Project

Create a new Stitch project and configure it with a design system for consistent UI generation.

## When to Use

- User wants to start a new design project in Stitch
- User says "create a new Stitch project", "start a design", "new UI project"
- User wants to set up a workspace before generating screens

## Workflow

### Step 1: Create the project

```text
stitch_create_project title="Project Name"
```

The tool returns a project. Save the project ID — you'll need it for all subsequent calls.

### Step 2: Verify the project

```text
stitch_get_project name="projects/<project-id>"
```

Confirm the project exists and check its `designSystem` field. If a default design system is already attached, skip to Step 4.

### Step 3: Create a design system

If no design system exists, create one. Ask the user about their preferences or use sensible defaults:

```text
stitch_create_design_system projectId="<project-id>" designSystem='{
  "displayName": "My Theme",
  "theme": {
    "colorMode": "LIGHT",
    "headlineFont": "INTER",
    "bodyFont": "INTER",
    "roundness": "ROUND_EIGHT",
    "customColor": "#2563eb"
  }
}'
```

Key decisions to clarify with the user if not specified:
- **Color mode**: LIGHT or DARK
- **Primary color**: hex color for branding
- **Font**: INTER (modern sans), SOURCE_SERIF_FOUR (editorial), SPACE_GROTESK (tech), etc.
- **Roundness**: ROUND_FOUR (sharp), ROUND_EIGHT (balanced), ROUND_TWELVE (soft), ROUND_FULL (pill)

### Step 4: Confirm setup

List the project's design systems:

```text
stitch_list_design_systems projectId="<project-id>"
```

Report back to the user with the project name, ID, and available design systems.

## Tips

- Always save the project ID — it's needed for every subsequent Stitch operation
- If the user has a brand color, use it as `customColor`
- For rapid prototyping, skip the design system creation and use the default
- The design system can be updated later with `stitch_update_design_system`
