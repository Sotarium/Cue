# Sotarium rebuild plan

## Scope

Rebuild the signed-in Agents workspace implied by `https://manus.im/app/agents` as a polished front-end prototype. The live page is gated behind authentication but exposes a left app shell with New task, Computers, Agents, Library, Creations, Automations, Plugins, and More. This rebuild focuses on the useful signed-in experience: browsing agents, searching, creating agents, viewing details, editing instructions, inspecting activity, and adjusting workspace settings.

## Implementation

- React + Vite front end with no backend dependency.
- Single-page application with client-side state for active section, search, selected agent, create-agent modal, detail drawer, editor mode, toast feedback, and settings toggles.
- Inline SVG icon system so the app has no external asset dependency.
- Data-driven agent cards and activity feed for realistic content.
- Responsive layout: desktop left rail and detail drawer; compact mobile header and horizontally scrollable content where needed.
- Public route manifest at `/manus-routes.json`.

## Project structure

- `index.html`: Vite entry document and font loading.
- `src/main.jsx`: React application, data model, interactions, and render tree.
- `src/styles.css`: visual system, responsive layout, states, modal/drawer, and animations.
- `public/manus-routes.json`: route declaration for the single-page app.

## Design direction

Three style options were considered: **Quiet Command Center** (0.04), **Soft Utility Canvas** (0.07), and **Midnight Atelier** (0.03). Chosen: **Quiet Command Center**.

- **Design Movement:** refined productivity software with editorial spacing and restrained dark chrome.
- **Core Principles:** calm hierarchy, high information density without clutter, clear action affordances, and purposeful motion.
- **Color Philosophy:** near-black blue-gray surfaces keep attention on content; warm paper white supports readability; violet and mint accents distinguish primary action from system status.
- **Layout Paradigm:** a persistent navigation rail anchors the left edge while a wide content canvas and contextual right drawer create a three-zone workbench.
- **Signature Elements:** a small lime Sotarium mark, soft violet active rail indicator, and thin status-line accents on cards.
- **Interaction Philosophy:** every click either changes visible context or confirms a state; hover surfaces make controls discoverable without visual noise.
- **Animation:** use 160–220ms ease-out transitions for hover, drawer, modal, and section changes; avoid continuous motion except subtle pulse on live status.
- **Typography System:** Inter for UI, a slightly heavier display weight for page titles, and compact uppercase metadata with generous letter spacing.
- **Brand Essence:** a focused workspace for shaping dependable AI teammates; precise, calm, approachable.
- **Brand Voice:** concise and confident. Example lines: “Shape the teammate.” and “Your agents are ready when the work is.”
- **Wordmark & Logo:** lowercase `cue.` wordmark with a lime bracketed dot-mark suggesting a cursor and a cue light.
- **Signature Brand Color:** electric chartreuse `#c8f563`, reserved for the Sotarium mark and high-confidence active states.
