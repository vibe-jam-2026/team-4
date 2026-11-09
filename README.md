# team-4
Vibe Jam 2026 – lag 4

## Gripen Starlane

An endless 3D space-lane flyer that runs in the browser. You fly a low-poly JAS 39 Gripen E along neon star lanes high above a ringed planet, chased by a hunter drone.

Play it at <https://vibe-jam-2026.github.io/team-4/>. The exercise instructions are still at [instructions.html](instructions.html).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Turn at a corner / change lane | ← → (or A D) | swipe left / right |
| Climb (over laser fences) | ↑ or W | swipe up |
| Dive (under blast doors) | ↓ or S | swipe down |
| Fire lasers (destroy asteroids) | Space, F or click | tap |
| Pause / mute | P / M | buttons |

Pressing left or right close to a corner banks you into the turn. The arrows on the barrier show which way to go. Anywhere else it moves you one lane. At a T-junction you pick the way.

### Rules

- Fly through energy rings to collect them. Power-ups: **Tractor Beam** pulls in rings, **Deflector** smashes through obstacles, **Double Rings**.
- Asteroids block lanes: dodge them or shoot them for bonus points.
- Your speed and score multiplier go up the farther you fly.
- If you scrape an asteroid while changing lanes, the hunter drone closes in. Scrape twice in quick succession and it shoots you down.
- Your best score and banked rings are saved in the browser.

### Running locally

The game is plain static files (Three.js is copied into `game/vendor/`), so there is no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk does not work, because ES modules need to be served over HTTP.
