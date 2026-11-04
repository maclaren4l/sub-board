# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sub Board: an offline-capable PWA for a youth soccer coach (lineup on a pitch, half clock, sub timer). Plain static files — no build step, no package manager, no dependencies, no tests, no linter. See [README.md](README.md) for the user-facing workflow.

## Running

Serve the folder statically and open it (service worker needs http, not `file:`):

```
python -m http.server 8000   # then http://localhost:8000
```

`window.__subBoard` exposes `{ state, tick }` for poking at game state from the browser console.

## Gotchas when changing things

- **Bump `VERSION` in [sw.js](sw.js)** after changing any cached file, or installed phones keep serving the old copy. If you add a file, add it to `FILES` in `sw.js` too.
- **Roster is hardcoded**: the `TEAM` array at the top of [app.js](app.js) seeds every new game (`fresh()` → `withTeam()`), and "Reset to full team" re-adds from it. Roster changes mean editing that list (plus the `VERSION` bump).
- **Saved-state compatibility**: state is persisted to `localStorage` under `sub-board:v1` and merged over `fresh()` in `load()`. New state fields need defaults in `fresh()`; one-off migrations live in `load()` (e.g. the `seeded` and `kitv` flags).

## Architecture ([app.js](app.js), one IIFE)

- **Single state object `S`** (persisted) plus a separate non-persisted `UI` object (selection, pending subs, open menus/dialogs). `S.phase` is `setup` → `game` → `summary`; within a game, `S.halfState` is `ready` / `running` / `paused` and `S.half` is 1 or 2. `S.lineup` is an 11-slot array of player ids indexed by formation spot (slot 0 is always the GK); `S.history` is the undo stack of lineup snapshots.
- **Render model**: `commit()` = `save()` + `render()`; `render()` rebuilds `#app` via template-string functions (`setupHTML`, `gameHTML`, `summaryHTML`) and `renderSheet()` rebuilds the settings sheet and dialog. All DOM events are delegated at `document` level: clicks dispatch on `data-act` to the `H` handler table, form submits on `data-form` to `FORMS`. Add a button by emitting `data-act="x"` in a template and adding `H.x`.
- **Clock**: a 250 ms `setInterval(tick)` accumulates elapsed time from `Date.now()` deltas (so backgrounding doesn't lose time), updating `clockMs`, per-player `played`/`bench` stats, and the sub-timer state machine (`idle` → `running` → `due`). `tick` re-renders fully only when `needsRender` is set (and not mid-drag); otherwise `paintLive()` patches just the `data-clock` / `data-subtime` / `data-subarc` / `data-ring` / `data-badge` / `data-wait` nodes. Keep live-changing text addressable via those `data-*` hooks rather than re-rendering.
- **Game screen layout**: `gameHTML()` is composed from `hudHTML()` (half clock + sub-timer ring), `trayHTML()` (queued-sub chips, or Auto-fill / Clear field before kickoff), the bench card grid, and `dockHTML()` (Undo/Clear, main action, ••• menu). The dock's main button is state-driven (Kick off / Make N subs / Pause / Resume / End half once time is up). Ring badges use `S.gameMs` (total game time across both halves, separate from the per-half `clockMs`) as the denominator.
- **Two interaction modes for the same gestures** keyed on `immediate()` (`halfState === 'ready'`): before kickoff, taps/drops place or swap players directly; during a half, bench→field gestures queue `UI.pending` {off,on} pairs that `confirmSubs` applies together. The goalie (spot 0) is guarded by `confirmGoalie` once the half is live, and cleared at halftime so a 2nd-half GK must be chosen (`S.goalies[half]` records who played).
- **Drag and drop** is hand-rolled with pointer events (`pointerdown`/`move`/`up`, ghost element, `dropTarget` hit-testing against `.disc` bounds). `performDrop` translates a drag into the same `H.spot` / `H.bench` handlers used for taps by faking `UI.sel` and a `{dataset}` stub — so drag and tap behavior share one code path. The bench is a non-scrolling grid with `touch-action: none` on cards, so drags start immediately on touch.
- **Formations** are tables of `[role, x%, y%]` in `FORMATIONS`; spot index order matters because `S.lineup` is positional. `changeFormation` remaps players by role group. `autofill` does bipartite matching of players' optional position `prefs` to empty spots.
- **Kit color** drives CSS custom properties (`--kit`, `--kit-ink`, `--gk`) via `applyKit()`, which also picks a keeper color that won't clash with the kit.
- Audio uses WebAudio beeps (unlocked on user gesture), `navigator.vibrate` (no-op on iOS), and the Screen Wake Lock API.
