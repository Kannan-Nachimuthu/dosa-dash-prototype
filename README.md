# Dosa Dash Prototype

This is a zero-cost HTML5 prototype of Dosa Dash — a simple time-management cooking game inspired by classics like Diner Dash and Cooking Fever. The prototype is built with Phaser 3 and is entirely client-side, so there are no hosting or API costs.

How to run locally
1. Clone the repo:

   git clone https://github.com/Kannan-Nachimuthu/dosa-dash-prototype.git

2. Open `index.html` in a modern browser. For mobile testing, host it on a local server (e.g., `npx http-server` or `python -m http.server`) and open the served URL on your phone.

What is included
- index.html — loads Phaser and the game.
- src/game.js — main Phaser scene with core loop: orders, batter pour, spread drag, flip, serve, and a minimal upgrade shop.
- README.md — this file.

Notes
- No external assets were used. Visuals are drawn procedurally for a minimal, zero-cost prototype.
- Progress (coins and upgrades) are stored in localStorage.
- This is an intentionally small vertical slice to validate the core loop. You can extend recipes, add SFX, polish animations, and add a shop/events system.

Next steps (suggested)
- Add sound effects (free SFX) and short stingers for actions.
- Improve visual polish: sprites for dosa, customers, and ingredients.
- Add a tutorial and onboarding with a guaranteed early win.
- Implement recipe-specific steps (masala dosa: add masala stage). 
- Publish via GitHub Pages (Settings → Pages) for easy sharing.

License: MIT
