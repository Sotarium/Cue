# Sotarium rebuild

This is a responsive React/Vite rebuild of the signed-in Agents workspace implied by `https://manus.im/app/agents`. The public reference redirects to sign-in, so this implementation focuses on the visible app shell and the core agent-management experience rather than reproducing the authentication wall.

## Included

The app includes the Sotarium navigation rail, Agents workspace, search and filters, favorites, grid/compact views, realistic agent cards, an agent detail drawer with Overview / Instructions / Activity tabs, inline editing, a create-agent modal, simulated run/toast feedback, and workspace settings with working toggles.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 5173. The production build is verified with `npm run build`.

## Notes

This is a front-end prototype with local React state and no external authentication or database dependency. The original implementation uses inline SVG icons and does not require image assets.
