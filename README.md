# team-4
Vibe Jam 2026 – lag 4

## Sunstone Escape

An endless 3D temple runner that runs in the browser. You stole the Sunstone idol, and now the stone Guardian is chasing you across crumbling causeways above an abyss.

Play it at <https://vibe-jam-2026.github.io/team-4/>. The exercise instructions are still at [instructions.html](instructions.html).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Turn at a corner / change lane | ← → (or A D) | swipe left / right |
| Jump (gaps, fallen logs) | ↑, W or Space | swipe up |
| Slide (low arches) | ↓ or S | swipe down |
| Pause / mute | P / M | buttons |

Pressing left or right close to a corner turns you. Anywhere else it moves you one lane. At a T-junction you pick the way.

### Rules

- Collect coins. Power-ups: **Magnet** pulls in coins, **Sun Ward** smashes through obstacles, **Double Coins**.
- Your speed and score multiplier go up the farther you run.
- If you bump into a statue while changing lanes, you stumble and the Guardian closes in. Stumble twice in quick succession and it catches you.
- Your best score and banked coins are saved in the browser.

### Running locally

The game is plain static files (Three.js is copied into `game/vendor/`), so there is no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk does not work, because ES modules need to be served over HTTP.
