---
name: stitch-iterate
description: Iterate on existing Google Stitch screens — edit, generate variants, and refine designs. Use when the user wants to modify a screen, explore design alternatives, adjust layout/colors, or improve an existing design.
license: MIT
metadata:
  package: pi-stitch-tools
  version: "1.0"
---

# Stitch — Iterate

Edit existing screens, generate design variants, and refine UI designs.

## When to Use

- User says "edit this screen", "change the layout", "try different styles"
- User wants to explore design alternatives or variants
- User wants to refine or improve an existing generated screen
- User says "iterate on", "try another version", "show me options"

## Workflow: Edit a screen

### Step 1: Identify the screen

List screens in the project:

```text
stitch_list_screens projectId="<project-id>"
```

Or get project details which includes screen instances:

```text
stitch_get_project name="projects/<project-id>"
```

### Step 2: Write an edit prompt

Be specific about what to change. Good edit prompts:

- "Change the hero background to a gradient from blue to purple"
- "Add a navigation bar with Home, About, and Contact links"
- "Replace the sign-up form with a two-column layout"
- "Make the cards use a glassmorphism style with blurred backgrounds"
- "Convert the desktop layout to a mobile layout with a hamburger menu"

### Step 3: Apply the edit

```text
stitch_edit_screens projectId="<project-id>" selectedScreenIds='["<screen-id>"]' prompt="<edit description>" deviceType="<type>"
```

You can edit multiple screens at once by including multiple screen IDs.

## Workflow: Generate variants

### Step 1: Choose screens to vary

```text
stitch_list_screens projectId="<project-id>"
```

Pick one or more screen IDs.

### Step 2: Configure variants

Set the creative range and aspects:

```text
stitch_generate_variants projectId="<project-id>" selectedScreenIds='["<screen-id>"]' prompt="<variation direction>" variantOptions='{
  "variantCount": 3,
  "creativeRange": "EXPLORE",
  "aspects": ["LAYOUT", "COLOR_SCHEME"]
}'
```

### Creative ranges

| Range | When to use |
|-------|-------------|
| REFINE | Subtle polish — spacing, alignment, minor tweaks |
| EXPLORE | Balanced exploration — try different approaches (default) |
| REIMAGINE | Radical redesign — completely different visual direction |

### Aspects to vary

| Aspect | What changes |
|--------|-------------|
| LAYOUT | Element arrangement and structure |
| COLOR_SCHEME | Color palette and theme |
| IMAGES | Imagery and graphics |
| TEXT_FONT | Typography choices |
| TEXT_CONTENT | Copy and text content |

### Step 3: Present variants

After generation, list the variants and let the user choose. Variants typically have `_variant_1`, `_variant_2`, etc. suffixes.

Get each variant:

```text
stitch_get_screen name="projects/<project-id>/screens/<screen-id>_variant_1"
```

## Workflow: Iterative refinement loop

```
1. Generate initial screen
2. Review → identify issues
3. Edit with specific corrections
4. Generate variants for exploration
5. Pick best variant
6. Apply design system for consistency
7. Repeat from step 2
```

## Tips

- **Edit first, then vary** — fix obvious issues before generating variants
- **Limit variant count** — 3 variants is the sweet spot; more creates decision fatigue
- **Be specific in edits** — "make the button larger" is better than "improve the UI"
- **Use REFINE for polish** — don't reimagine a screen that just needs small tweaks
- **Vary one thing at a time** — change layout OR colors, not both, for clear comparisons
- **Keep the best variant** — delete variants you don't need to keep the project clean
