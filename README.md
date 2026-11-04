# Sub Board

A sideline tool for a youth soccer coach: set your starting 11 on a top-down pitch, run the half clock, and rotate 3–4 players at a time on a sub timer you start yourself. Built for an iPhone 15 Pro, works on iPad. No accounts, no internet needed once installed.

## Using it

1. **Game day** – your 16 players are already loaded and marked here; to change the team, edit the `TEAM` list at the top of `app.js` (and bump `VERSION` in `sw.js`). You can also add players (type, or paste a list), tap a name to mark someone absent. Optional position tags mark where she likes to play: GK (goalie), D (defense), M (midfield), LW (left wing), RW (right wing) and F (forward). A player can have several. They only highlight spots, and feed Auto-fill if you tap it; they never decide for you. Choose formation, half length (default 35), and minutes between subs (3–7).
2. **Lineup** – drag a bench player onto a spot on the field (or tap the player, then the spot). Drag one field player onto another to swap them, or onto the bench to take them off. The bench is a card grid, longest wait first. Tap two field players to swap them. "Auto-fill by position" (above the bench) uses the tags to fill empty spots.
3. **Kick off** – starts the half clock. Tap the ring in the top card (**Start subs**) whenever you want the next sub window to begin; the ring drains as the window runs. At zero the card turns orange and beeps; tap the ring to silence it, or ↻ to reset.
4. **Make subs** – drag a bench player onto the field player coming off (or tap one, then the other). Each swap shows as a chip above the bench, a green pill on the player coming off, and a green outline on the replacement. Tap **Make N subs** in the bottom dock when the ref lets you. The sub takes the same spot. **Undo** is in the toast and the ↶ button.
5. **Goalie** – set per half. During a half the goalie has a padlock; tapping or dragging her asks "Swap the goalie?" first (for an injury). At halftime the goalie spot is cleared so you choose the 2nd-half goalie, and the app warns if you pick the same player again.
6. Each player's ring fills with their share of the game on the field, with minutes played beside it. Teal (▼) = behind on playing time, amber (▲) = ahead.
7. **End half** (in the ••• menu, and the main dock button once time is up) → halftime lineup → **Kick off 2nd half** → **End half** shows minutes played per player.

The game is saved on the device, so a reload or phone lock won't lose it. The dock's **•••** menu has End half, Game settings (formation, minutes between subs, half length), Late arrival, and "End game…".

## Put it on your iPhone

The app is plain files, so any static host works. Easiest free options:

- **GitHub Pages**: create a repo, upload these files, Settings → Pages → deploy from `main`.
- **Netlify Drop** (app.netlify.com/drop): drag this folder onto the page.

Then open the HTTPS link in **Safari** on the iPhone → Share → **Add to Home Screen**. Open it once with signal; after that it runs offline.

To test on a computer first: `python -m http.server 8000` in this folder, then open http://localhost:8000.

## Field notes

- iPhone: set Auto-Lock to Never during games. The app asks to keep the screen awake, but iOS can ignore that. If the screen locks, the sub beep can't fire.
- Sound plays even with the ring switch on silent (iOS 17+); turn the volume up. iPhone Safari doesn't support vibration, so the alert is sound plus the orange flash.
- If you change any file after installing, bump `VERSION` in `sw.js` so phones pick up the update.

## Files

`index.html` · `styles.css` · `app.js` · `sw.js` (offline cache) · `manifest.webmanifest` · `icons/`
