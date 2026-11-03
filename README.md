# Sub Board

A sideline tool for a youth soccer coach: set your starting 11 on a top-down pitch, run the half clock, and rotate 3–4 players at a time on a sub timer you start yourself. Built for an iPhone 15 Pro, works on iPad. No accounts, no internet needed once installed.

## Using it

1. **Game day** – your 16 players are already loaded and marked here; to change the team, edit the `TEAM` list at the top of `app.js` (and bump `VERSION` in `sw.js`). You can also add players (type, or paste a list), tap a name to mark someone absent. Optional GK / D / M / F tags mark positions she likes; they only highlight spots, they never decide for you. Choose formation, half length (default 35), and minutes between subs (3–7).
2. **Lineup** – drag a bench player onto a spot on the field (or tap the player, then the spot). Drag one field player onto another to swap them, or onto the bench to take them off. On the bench, swipe sideways to scroll; press and hold a chip for a moment to drag it in any direction. Tap two field players to swap them. "Auto-fill by position" uses the tags to fill empty spots.
3. **Kick off** – starts the half clock. Tap **Start sub timer** whenever you want the next sub window to begin. At zero the card turns orange and beeps.
4. **Make subs** – drag a bench player onto the field player coming off (or tap one, then the other). Repeat for 3–4 swaps; numbers show the pairs. Tap **Make N subs** when the ref lets you. The sub takes the same spot. **Undo** is in the toast and the ↶ button.
5. Bench is sorted longest-wait first. Minute badges: teal = behind on playing time, amber = ahead.
6. **End half** → halftime lineup → **Kick off 2nd half** → **End half** shows minutes played per player.

The game is saved on the device, so a reload or phone lock won't lose it. **Game settings (⚙)** has formation, late arrivals, and "start over".

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
