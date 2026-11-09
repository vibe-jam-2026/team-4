# team-4
Vibe Jam 2026 – lag 4

## Wings of War Forever

An endless 3D sky-track flyer that runs in the browser. You fly a low-poly JAS 39 Gripen E along a glass track high above a sea of clouds, chased by a hunter drone.

Play it at <https://vibe-jam-2026.github.io/team-4/>. The exercise instructions are still at [instructions.html](instructions.html).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Turn at a corner / change lane | ← → (or A D) | swipe left / right |
| Climb (over laser fences) | ↑ or W | swipe up |
| Dive (under overhead barriers) | ↓ or S | swipe down |
| Fire a missile (homes in on sky mines) | Space, F or click | tap |
| Pause / mute | P or the pause button / M | buttons |
| Pause? | Esc | |

Near a corner, a **TURN** prompt and arrows on the track show which way to go. Pressing left or right then banks you into the turn; anywhere else it moves you one lane. At a T-junction you pick the way.

The menu says Esc pauses. It doesn't: Esc pulls the ejection handle and ends your run.

### Rules

- Fly through gold rings to collect them. Power-ups: **Tractor Beam** pulls in rings, **Deflector** smashes through obstacles, **Double Rings**.
- Sky mines block lanes: dodge them or shoot them. You carry two wingtip missiles, and each one reloads about a second after firing.
- Your speed and score multiplier go up the farther you fly.
- If you scrape a mine while changing lanes, the hunter drone closes in. Scrape twice in quick succession and it shoots you down.
- Your best score and banked rings are saved in the browser.

### Running locally

The game is plain static files (Three.js is copied into `game/vendor/`, the Teko and Exo 2 fonts into `game/fonts/`), so there is no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk does not work, because ES modules need to be served over HTTP.
