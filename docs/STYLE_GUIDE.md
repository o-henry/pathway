# Visual Style Guide

## 1. Direction

The app should look like a thoughtful, playful mind-map rather than a sterile productivity dashboard.
Use the reference images under `assets/references/` as inspiration.

Keywords:

- soft pastel
- rounded cards
- hand-drawn connectors
- light paper background
- spacious branches
- readable labels
- small playful accents

## 2. Layout

Use a central goal node with outward branches for high-level routes.
For route maps, prefer left-to-right or center-out layout depending on map density.

Default layout modes:

- `radial_mindmap`: central goal with branches around it
- `route_tree`: left-to-right progression tree
- `comparison_map`: routes as columns

ELK.js should be used for deterministic auto layout. The UI may add tiny visual jitter for hand-drawn feel, but the underlying graph coordinates must remain deterministic.

## 3. Nodes

Node component requirements:

- Rounded rectangle or pill shapes.
- Pastel background based on ontology style token.
- Optional sketch border using Rough.js or CSS `filter`/SVG overlay.
- Clear type label in small text.
- Main label readable in 1–3 lines.
- Evidence badge if evidence exists.
- Assumption badge if assumptions exist.
- Risk marker when risk score is high.

Tone tokens:

```text
mint
lavender
peach
sky
rose
sand
yellow
slate
```

Unknown tone token falls back to `slate`.

## 4. Edges

Edge styles:

- curved branch connector
- sketch arrow
- dotted evidence/reference line
- soft disabled line for rejected route
- highlighted line for selected route

Do not make lines so playful that path direction becomes unclear.

## 5. Interaction

Minimum interactions:

- click node -> detail drawer
- hover edge -> condition label
- select route -> highlight path
- evidence badge -> open evidence drawer
- assumption badge -> open assumptions section
- zoom/pan controls
- fit view

## 6. Detail drawer

Show:

- label
- type label
- summary
- dynamic fields from ontology
- scores
- evidence
- assumptions
- connected next choices
- route status

## 7. Accessibility

- Text contrast must remain readable.
- Do not rely only on color to indicate risk/evidence/status.
- Keyboard focus states required for nodes and important buttons.
- Motion should be minimal and optional.
