# UI checks

Three headless-Chrome scripts that drive the served app and print `PASS` / `FAIL` lines (non-zero exit code on any failure):

- `toast-fixes.js` — the toast sits 8 px above the dock and stays centred over it, is skipped while the ••• menu is open, auto-hides, and is cleared by New game and Reset to full team.
- `toast-taps.js` — the toast ignores pointer events, so taps reach the bench cards under it; only its Undo button takes taps. Where the toast doesn't overlap the bench (phone landscape, iPad) it prints `N/A` for the tap-through step.
- `formation-pick.js` — the formation chip on the pitch switches formation mid-half: the list opens on top of the players, the switch keeps the goalie, the players on the field and any queued sub, the toast offers Undo (which restores formation and lineup), and taps on the pitch or the dock close the list. It then ends the half and repeats the switch on the lineup screen before the 2nd-half kickoff: the empty goalie spot stays empty (no outfield player is dropped in goal), the players stay the same, and once a keeper is picked a further switch keeps them in goal.

## Setup

The repo has no dependencies, so install `puppeteer-core` in a folder **outside** it (it drives your installed Chrome and downloads no browser):

```
mkdir %USERPROFILE%\sub-board-tools && cd %USERPROFILE%\sub-board-tools
npm install puppeteer-core
```

Then, in the shell you run the scripts from, point Node at it. `CHROME` is only needed if Chrome isn't at `C:\Program Files\Google\Chrome\Application\chrome.exe`.

```
# PowerShell
$env:NODE_PATH = "$env:USERPROFILE\sub-board-tools\node_modules"
$env:CHROME = "C:\path\to\chrome.exe"        # optional

# bash (Git Bash)
export NODE_PATH="$HOME/sub-board-tools/node_modules"
export CHROME="/path/to/chrome"              # optional
```

## Run

Serve the app (`python -m http.server 8000` in the repo root), then from the repo root run each script at the three viewports: portrait phone, phone landscape, iPad landscape.

```
node tests/toast-fixes.js http://localhost:8000/ 393 852
node tests/toast-fixes.js http://localhost:8000/ 852 393
node tests/toast-fixes.js http://localhost:8000/ 1180 820

node tests/toast-taps.js http://localhost:8000/ 393 852
node tests/toast-taps.js http://localhost:8000/ 852 393
node tests/toast-taps.js http://localhost:8000/ 1180 820

node tests/formation-pick.js http://localhost:8000/ 393 852
node tests/formation-pick.js http://localhost:8000/ 852 393
node tests/formation-pick.js http://localhost:8000/ 1180 820
```

All three scripts load the in-app sample roster first (the app has no built-in team), so they work from a fresh browser context.

Arguments are `[url] [width] [height]`, defaulting to `http://localhost:8000/` at 393x852. To check the published site, use `https://maclaren4l.github.io/sub-board/` as the URL. Each run takes a fresh browser context, so saved game state never carries over; `toast-fixes.js` takes about 20 s because it waits out the 9 s Undo toast.
