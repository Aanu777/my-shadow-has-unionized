# MY SHADOW HAS UNIONIZED

A comedic 2D puzzle-platformer prototype built with Phaser + TypeScript.

> You control the pumpkin. The shadow controls the terms and conditions.

## Run locally (Windows)

1. Install Node.js LTS from https://nodejs.org/ if it is not installed.
2. Open this folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open the local URL Vite prints (usually `http://127.0.0.1:5173`).

## Controls

- **A / D** or **Left / Right:** move
- **W / Space / Up:** jump
- **E:** interact with the lantern or nearby objects
- **R:** restart the room

## First milestone

- A playable pumpkin character with platform collision and jumping
- A movable lantern that changes the projected shadow route
- A shadow-only path across a gap
- A demand item (coffee) that satisfies the shadow's break demand
- A switch and an exit gate
- A small dialogue system and a completion screen

## Current implementation notes

This is a deliberately asset-free first playable: the characters, platforms, lantern, shadow route, and interface are drawn in code. That makes the prototype easy to run immediately and avoids blocking progress on art production.

The shadow route is a designed gameplay abstraction, not a physically accurate optics simulation. Moving the lantern changes the shadow's projected anchor and the available route.

## Next milestones

1. Replace code-drawn characters with custom pixel art and animations.
2. Add three more handcrafted levels and checkpoint persistence.
3. Add music, sound effects, particles, and accessibility options.
4. Tune puzzle difficulty and record the Devpost demo.
