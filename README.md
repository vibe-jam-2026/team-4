# team-4
Vibe Jam 2026 – lag 4

## Wings of War Forever

An endless 3D sky-track flyer that runs in the browser. You fly a low-poly JAS 39 Gripen E along a track of floating lights high above a sea of clouds, chased by a hunter drone and attacked head-on by enemy fighters.

Play it at <https://vibe-jam-2026.github.io/team-4/>. The exercise instructions are still at [instructions.html](instructions.html).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Turn at a corner / change lane | ← → (or A D) | swipe left / right |
| Barrel roll (deflects enemy cannon fire) | Shift + ← → | two-finger swipe |
| Loop (clears anything you time it over) | E | |
| Climb (over laser fences) | ↑ or W | swipe up |
| Dive (under overhead barriers) | ↓ or S | swipe down |
| Fire a missile (homes in on mines and fighters) | Space, F or click | tap |
| Pause / mute | P or the pause button / M | buttons |
| Pause? | Esc | |

Near a corner, a **TURN** prompt and arrows show which way to go. Pressing left or right then banks you into the turn; anywhere else it moves you one lane. At a T-junction you pick the way.

The menu says Esc pauses. It doesn't: Esc pulls the ejection handle and ends your run.

### Rules

- Fly through gold rings to collect them. Power-ups: **Tractor Beam** pulls in rings, **Deflector** smashes through obstacles, **Double Rings**.
- Sky mines block lanes: dodge them or shoot them. You carry two wingtip missiles, and each one reloads about a second after firing.
- After 250 m, enemy fighters attack head-on. They line up on your lane and open fire: change lanes, barrel-roll through the bullets, loop over them, or shoot them down for a big bonus.
- Your speed and score multiplier go up the farther you fly.
- If you scrape a mine while changing lanes, the hunter drone closes in. Scrape twice in quick succession and it shoots you down.

### Campaign

Next to Endless, the **Campaign** has four levels, each with its own map and a boss at the end:

| Level | Map | Boss appears at | Boss (original designs inspired by Russian aircraft) |
| --- | --- | --- | --- |
| 1 | Ocean, with islands below | 1,500 points | Heavy twin-tail fighter "Flanker" |
| 2 | Mountains, with peaks beside the track | 2,500 points | Swing-wing strategic bomber "Blackjack" |
| 3 | Night, with glowing mines | 3,500 points | Stealth fighter "Felon" |
| 4 | Storm over the sea, one long straight with no turns | right away | Final boss: ekranoplan "Sea Monster", in three phases |

A bar at the top shows how close you are to the boss. The boss flies ahead of you, drops mines into the lanes and fires tracers back at you. Shoot it down with missiles to clear the level. Bosses get faster and more aggressive as they lose health, and they climb over gates and corner barriers instead of flying through them. Clearing a level unlocks the next one, and your score carries over.

### Loyal wingmen

You start every run (and every campaign level) with three loyal wingmen, shown at the top of the screen. If you are about to hit a mine, a wingman drone swoops in and shoots it down. When all three are used, the next mine you hit ends the run.

### Leaderboard and hangar

- The top 10 Endless scores on your device are kept in a local leaderboard. Enter your callsign after a qualifying run, or press Space to fly again (your last callsign is used).
- Rings you collect are banked. Spend them in the **Hangar** on Gripen color schemes: Sweden (50), Ukraine (100) and Brazil (150).
- Everything is saved in the browser's local storage.

### Running locally

The game is plain static files (Three.js is copied into `game/vendor/`, the Teko and Exo 2 fonts into `game/fonts/`), so there is no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` straight from disk does not work, because ES modules need to be served over HTTP.

### Trailer

A 5-second vertical (9:16) trailer for reels and stories is in [media/trailer-reel.mp4](media/trailer-reel.mp4).
