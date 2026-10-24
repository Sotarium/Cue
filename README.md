# Sotarium rebuild

This is a responsive React/Vite rebuild of the Cue-style Windows productivity experience referenced by the Microsoft Store listing. The Sotarium version uses a light, chat-first workspace with a conversation rail, persistent personal agents, colorful character avatars, tool handoffs, memory updates, and an interactive composer.

## Included

The root route is the clean Sotarium download homepage. Its primary button downloads `Sotarium.exe` from the latest GitHub release, and the secondary link opens the Microsoft Store listing. `/app` opens the browser workspace. The packaged Windows executable opens the workspace directly, like a standalone desktop app.

The first-run screen is a Rollbux-inspired Sotarium sign-up/login flow. It stores a local demo account in browser storage and does not read, store, or scrape Rollbux session cookies or private Rain Rewards transactions. A real connection would require an official Rollbux API or OAuth integration.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 5173. The production build is verified with `npm run build`. To package the Windows app, run `npm run desktop:build`; the portable executable is written to `release/Sotarium.exe`.

## Notes

This is a front-end prototype with local React state and no external authentication or database dependency. The original implementation uses inline SVG icons and does not require image assets.
