# ChessWeb

A complete, dependency-light chess web app: **online P2P multiplayer**, **local pass & play**, and **offline vs Stockfish** — deployable as-is on GitHub Pages. No account, no backend server.

## Run / Deploy

1. Copy `index.html`, `styles.css`, `game.js`, `ai.js`, `network.js` into a folder.
2. Push to a GitHub repository → **Settings → Pages → Deploy from branch** (root). Done.
3. Or open `index.html` via any static file server (e.g. `npx serve .`).

> CDN dependencies (jQuery, chess.js, chessboard.js, PeerJS, Stockfish) are loaded from public CDNs, so an internet connection is required for online play and for the Stockfish engine. If the Stockfish CDN is unreachable, a built-in alpha-beta engine takes over automatically, so vs-AI always works.

## Features

- **Online multiplayer (WebRTC via PeerJS public cloud)** — 6-digit room codes + shareable invite links (`#room=CODE`), real-time move/clock sync, draw offers, resignations, rematches with color swap, and automatic reconnection with full state re-sync after brief drops.
- **Pass & Play** — two players on one device, optional auto-rotating board.
- **vs Computer** — Stockfish 10 (Easy ~1000 / Medium ~1500 / Hard 2000+ ELO equivalents) with a built-in fallback engine.
- **Chess.com-style UX** — SAN move list with ⏮◀▶⏭ replay navigation, legal-move dots, last-move & check highlights, synthesized sound effects (move/capture/castle/check/game-end), customizable Blitz/Rapid/Bullet clocks with increment and auto-flag, captured-pieces tray with material advantage (+n), dark/light themes, 6 board color themes + custom colors, two piece sets, full mobile/desktop responsive layout with drag-and-drop and tap-to-move, promotion picker, draw-by-agreement/resign/rematch in every mode.

## File map

| File | Responsibility |
|---|---|
| `index.html` | Markup, screens, modals, CDN script tags |
| `styles.css` | Theme tokens, layout, board highlight overlays, responsive rules |
| `game.js` | Game controller: state, board UI, clocks, move list, sounds, settings, mode wiring |
| `network.js` | PeerJS rooms, heartbeat, reconnect & state re-sync |
| `ai.js` | Stockfish loader + built-in alpha-beta fallback engine |
