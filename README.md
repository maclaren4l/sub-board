# Sub Board

A sideline tool for a youth soccer coach: set your starting 11 on a top-down pitch, run the half clock, and rotate 3–4 players at a time on a sub timer you start yourself. Built for an iPhone 15 Pro (portrait, or landscape with the pitch on the left and controls on the right), works on iPad. No accounts, no internet needed once installed.

## Using it

1. **Game day** – your team list lives on the device, so the first time you open the app, add your players (type a name, or paste a whole list). The list is saved and every new game starts with everyone on it marked as here. Tap a name to mark someone absent for today, **×** (it asks first) to take someone off the team for good, and **Reset to full team** to mark everyone here again. Players added through Late arrival during a game are for that game only. Optional position tags mark where a player likes to play, and they are saved with the team: GK (goalie), D (defense), M (midfield), LW (left wing), RW (right wing) and F (forward). A player can have several. They only highlight spots, and feed Auto-fill if you tap it; they never decide for you. Choose formation, half length (default 35), and minutes between subs (3–7).
2. **Lineup** – drag a bench player onto a spot on the field (or tap the player, then the spot). Drag one field player onto another to swap them, or onto the bench to take them off. The bench is a card grid, longest wait first; with more than 5 players on it (for example before the lineup is set) it becomes two rows you swipe sideways. Tap two field players to swap them. "Auto-fill by position" (above the bench) uses the tags to fill empty spots.
3. **Kick off** – starts the half clock. Tap the ring in the top card (**Start subs**) whenever you want the next sub window to begin; the ring drains as the window runs. At zero the card turns orange and beeps; tap the ring to silence it, or ↻ to reset.
4. **Make subs** – drag a bench player onto the field player coming off (or tap one, then the other). Each swap shows as a chip above the bench, a green pill on the player coming off, and a green outline on the replacement. Tap **Make N subs** in the bottom dock when the ref lets you. The sub takes the same spot. Moving one field player onto another during a half swaps their spots and keeps any queued subs; tap a queued player (with nothing selected) to cancel that sub. **Undo** is in the toast and the ↶ button. It steps back through lineup and formation changes, but never past kickoff (or halftime).
5. **Goalie** – set per half. During a half the goalie has a padlock; tapping or dragging her asks "Swap the goalie?" first (for an injury), and the new goalie is the one recorded for that half. At halftime the goalie spot is cleared so you choose the 2nd-half goalie, and the app warns if you pick the same player again.
6. Each player's ring fills with their share of the game on the field, with minutes played beside it. Teal (▼) = behind on playing time, amber (▲) = ahead.
7. **End half** (in the ••• menu, and the main dock button once time is up) → halftime lineup → **Kick off 2nd half** → **End half** shows minutes played per player.

The game is saved on the device, so a reload or phone lock won't lose it. The dock's **•••** menu has End half, Game settings (formation, minutes between subs, half length), Late arrival, and "End game…".

## Put it on your iPhone

The app is plain files, so any static host works. It is published with **GitHub Pages** from the `main` branch of [maclaren4l/sub-board](https://github.com/maclaren4l/sub-board) at **https://maclaren4l.github.io/sub-board/**. To host your own copy, create a repo, push these files, then Settings → Pages → deploy from `main` (root). **Netlify Drop** (app.netlify.com/drop) also works: drag this folder onto the page.

Then open the HTTPS link in **Safari** on the iPhone → Share → **Add to Home Screen**. Open it once with signal; after that it runs offline.

Notes on hosting:

- The repo and Pages site are public, but no player names are in the code: the team list is stored only in the browser on your device (`localStorage`). The flip side is that it exists only there, so clearing the site's data or deleting the home-screen app loses it, and a second phone needs its own copy typed or pasted in.
- iOS keeps the home-screen app's saved game separate from Safari's, so set up the roster and game in the installed app, not in a Safari tab.

To test on a computer first: `python -m http.server 8000` in this folder, then open http://localhost:8000.

To publish a change: edit the files, bump `VERSION` in `sw.js`, then commit and push to `main`. Pages takes a minute or two, and phones pick the update up the next time the app is opened with signal.

## Field notes

- iPhone: set Auto-Lock to Never during games. The app asks to keep the screen awake, but iOS can ignore that. If the screen locks, the sub beep can't fire.
- Sound plays even with the ring switch on silent (iOS 17+); turn the volume up. iPhone Safari doesn't support vibration, so the alert is sound plus the orange flash. The app tries to wake its audio when you come back to it after a lock, but iOS can still keep it silent until you tap something.
- If the app is closed during a half and reopened more than 15 minutes later, the game comes back paused with that gap not counted. Press Resume to carry on.
- If you change any file after installing, bump `VERSION` in `sw.js` so phones pick up the update.

## Files

`index.html` · `styles.css` · `app.js` · `sw.js` (offline cache) · `manifest.webmanifest` · `icons/`
