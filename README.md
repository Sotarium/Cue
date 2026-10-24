# Sotarium rebuild

This is a responsive React/Vite rebuild of the Cue-style Windows productivity experience referenced by the Microsoft Store listing. The Sotarium version uses a light, chat-first workspace with a conversation rail, persistent personal agents, colorful character avatars, tool handoffs, memory updates, and an interactive composer.

## Included

The root route opens the chat workspace. `/download` opens a clean Sotarium download page whose button links to the Microsoft Store listing supplied for the reference app.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 5173. The production build is verified with `npm run build`.

## Notes

This is a front-end prototype with local React state and no external authentication or database dependency. The original implementation uses inline SVG icons and does not require image assets.
