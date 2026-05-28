---
name: stitch-generate-screen
description: Generate UI screens in Google Stitch from text descriptions. Use when the user wants to create a new screen, page, or UI component design — landing pages, dashboards, login forms, settings pages, mobile screens, etc.
license: MIT
metadata:
  package: pi-stitch-tools
  version: "1.0"
---

# Stitch — Generate Screen

Generate high-quality UI screens from natural language descriptions.

## When to Use

- User says "generate a login page", "create a dashboard", "design a landing page"
- User wants to visualize a UI concept
- User needs a starting point for a frontend implementation
- User wants a specific type of screen (settings, profile, checkout, etc.)

## Workflow

### Step 1: Gather requirements

Before generating, clarify with the user:
- **Project ID** — which Stitch project to use
- **Screen purpose** — what is this screen for?
- **Device type** — MOBILE, DESKTOP, TABLET, or AGNOSTIC
- **Key elements** — what must be on the screen?

If the user hasn't specified, ask or infer from context.

### Step 2: Get the project context

```text
stitch_get_project name="projects/<project-id>"
```

Note the `designSystem` asset ID. If one exists, always pass it for design consistency.

### Step 3: Write a detailed prompt

Good prompts produce dramatically better results. Structure them with:

```
<screen-type>: A <purpose> screen for <audience/context>
Layout: <key layout description>
Elements:
- <element 1> with <details>
- <element 2> with <details>
Style: <visual style keywords>
```

**Example — Landing Page:**
```
A modern SaaS landing page for a developer tool. Hero section with headline "Build Faster" and CTA button "Get Started". Features section with 3 cards showing key benefits. Clean, minimal design with generous whitespace. Dark navbar with logo on left and nav links on right.
```

**Example — Mobile Login:**
```
Mobile login screen for a fintech app. Email and password fields with labels above. "Sign In" button full-width at bottom. "Forgot password?" link below the form. Clean white background with subtle branding at top. iOS-style design.
```

### Step 4: Generate

```text
stitch_generate_screen_from_text projectId="<project-id>" prompt="<detailed prompt>" designSystem="<design-system-id>" deviceType="<type>"
```

Generation can take 1-3 minutes. The tool may return `output_components` with suggestions — present these to the user.

### Step 5: Handle results

If the tool returns suggestions (e.g., "Add a navigation bar"), ask the user if they want to apply them.

After generation, get the screen details:

```text
stitch_get_screen name="projects/<project-id>/screens/<screen-id>"
```

## Prompt Engineering Tips

| Do | Don't |
|-----|--------|
| Be specific about layout | Use vague terms like "nice design" |
| List concrete elements | Describe abstract concepts |
| Mention device context | Skip device type entirely |
| Include visual style keywords | Use overly technical CSS terms |
| Reference real UI patterns | Invent non-standard interactions |

### Effective style keywords

- "clean and minimal", "bold and colorful", "dark mode", "glassmorphism"
- "iOS-style", "Material Design", "enterprise dashboard"
- "with illustrations", "data-heavy", "content-first"

## After Generation

The generated screen exists in Stitch. From here the user can:
- Edit it with `stitch_edit_screens`
- Generate variants with `stitch_generate_variants`
- Apply/change the design system with `stitch_apply_design_system`
- Export or use as reference for frontend implementation
