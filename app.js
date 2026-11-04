/* Sub Board — lineup, game clock and substitution timer for youth soccer.
   No build step, no dependencies. State lives in localStorage so a reload or phone lock never loses the game. */
(() => {
'use strict';

const KEY = 'sub-board:v1';
const COLORS = ['#39FF14', '#2457D6', '#D62839', '#7B2CBF', '#F77F00', '#1B1B1E'];
const ROLES = ['GK', 'DEF', 'MID', 'LW', 'RW', 'FWD'];
const ROLE_LABEL = { GK: 'GK', DEF: 'D', MID: 'M', LW: 'LW', RW: 'RW', FWD: 'F' };
const ROLE_NAME = { GK: 'goalkeeper', DEF: 'defense', MID: 'midfield', LW: 'left wing', RW: 'right wing', FWD: 'forward' };
const ROLE_TITLE = { GK: 'Goalie', DEF: 'Defense', MID: 'Midfield', LW: 'Left wing', RW: 'Right wing', FWD: 'Forward' };

// [role, x%, y%] — our goal is at the bottom, we attack up the screen. Order: GK, back line, then rows front-to-back is NOT used; rows go back to front, left to right.
const FORMATIONS = {
  '4-3-3':   [['GK',50,89],['DEF',14,68],['DEF',37,71],['DEF',63,71],['DEF',86,68],['MID',26,50],['MID',50,53],['MID',74,50],['LW',18,25],['FWD',50,19],['RW',82,25]],
  '4-4-2':   [['GK',50,89],['DEF',14,68],['DEF',37,71],['DEF',63,71],['DEF',86,68],['LW',14,48],['MID',37,52],['MID',63,52],['RW',86,48],['FWD',35,22],['FWD',65,22]],
  '3-5-2':   [['GK',50,89],['DEF',24,69],['DEF',50,72],['DEF',76,69],['LW',10,47],['MID',30,52],['MID',50,45],['MID',70,52],['RW',90,47],['FWD',35,22],['FWD',65,22]],
  '3-4-3':   [['GK',50,89],['DEF',24,69],['DEF',50,72],['DEF',76,69],['LW',14,50],['MID',38,53],['MID',62,53],['RW',86,50],['LW',18,25],['FWD',50,19],['RW',82,25]],
  '4-2-3-1': [['GK',50,89],['DEF',14,68],['DEF',37,71],['DEF',63,71],['DEF',86,68],['MID',34,58],['MID',66,58],['LW',16,39],['MID',50,37],['RW',84,39],['FWD',50,17]]
};

const STALE_MS = 15 * 60e3; // a "running" game saved longer ago than this resumes paused
const CIRC = 2 * Math.PI * 40; // sub-timer ring circumference (r=40 in a 96 viewBox)

const SAMPLE = ['Ava', 'Mia', 'Zoe', 'Lily', 'Emma', 'Chloe', 'Nora', 'Ruby', 'Ella', 'Grace', 'Maya', 'Ivy', 'Sofia', 'Layla', 'Hazel', 'Piper'];

/* ---------------- State ---------------- */
// Your team. Edit this list when the roster changes; every new game starts with everyone marked as here.
const TEAM = ['Zara A.', 'Marielle B.', 'Bratford', 'Abbie C.', 'Annabelle H.', 'Ella K.', 'Ella M.', 'Baily M.',
  'Grace M.', 'Cameron O.', 'Aurelia P.', 'Cici R.', 'Katie S.', 'Brooklyn S.', 'Lucille S.', 'Olivia W.'];

const fresh = () => withTeam({
  v: 1, seeded: 1, phase: 'setup', nextId: 1, players: [], stats: {},
  settings: { formation: '4-3-3', halfMin: 35, subMin: 5, autoStart: false, color: COLORS[0], kitv: 2 },
  lineup: Array(11).fill(null), half: 1, halfState: 'ready', clockMs: 0, lastTick: Date.now(),
  sub: { state: 'idle', ms: 0, silenced: false }, halfAlerted: false, history: [], goalies: {}, gameMs: 0
});
function withTeam(s) {
  for (const name of TEAM) { const id = 'p' + s.nextId++; s.players.push({ id, name, present: true, prefs: [] }); s.stats[id] = { played: 0, bench: 0 }; }
  return s;
}

let S = load() || fresh();
const UI = { openPrefs: null, sel: null, pending: [], menu: false, more: false, paste: false, focusAdd: false, dlg: null };
let needsRender = false, lastSave = 0, lastDueBeep = 0, drag = null, suppressClickUntil = 0;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw), s = Object.assign(fresh(), saved);
    s.settings = Object.assign(fresh().settings, s.settings);
    if (!saved.settings || saved.settings.kitv !== 2) { s.settings.color = COLORS[0]; s.settings.kitv = 2; } // team kit is neon green
    // Saved by an older build (empty or sample roster): load the team once, unless a game is already under way.
    if (!saved.seeded) { s.seeded = 1; if (s.phase === 'setup') { s.players = []; s.stats = {}; s.nextId = 1; withTeam(s); } }
    // A game left "running" longer than a locked phone plausibly stays asleep means the app was closed; resume paused rather than inventing time.
    if (s.halfState === 'running' && Date.now() - s.lastTick > STALE_MS) s.halfState = 'paused';
    if (s.halfState !== 'running') s.lastTick = Date.now();
    return s;
  } catch (e) { return null; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep playing */ } }
function commit() { save(); render(); }

/* ---------------- Helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = id => S.players.find(p => p.id === id);
const st = id => S.stats[id] || (S.stats[id] = { played: 0, bench: 0 });
const present = () => S.players.filter(p => p.present);
const spots = () => FORMATIONS[S.settings.formation];
const halfMs = () => S.settings.halfMin * 60000;
const subMs = () => S.settings.subMin * 60000;
const mins = ms => Math.floor(ms / 60000);
const immediate = () => S.halfState === 'ready';
function fmt(ms, up) { const s = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function initials(name) { const w = name.trim().split(/\s+/); return (w[0][0] + (w[1] ? w[1][0] : '')).toUpperCase(); }
function avgPlayed() { const ps = present(); return ps.length ? ps.reduce((a, p) => a + st(p.id).played, 0) / ps.length : 0; }
function fairness(id, avg) { const d = st(id).played - avg; return d < -120000 ? 'owed' : d > 120000 ? 'ahead' : ''; }
function benchPlayers() {
  return present().filter(p => !S.lineup.includes(p.id))
    .sort((a, b) => st(b.id).bench - st(a.id).bench || st(a.id).played - st(b.id).played || a.name.localeCompare(b.name));
}
const pairIdx = pid => UI.pending.findIndex(p => p.off === pid || p.on === pid);
// Undo snapshots hold the formation too, since lineup slots are positional. The stack is emptied at kickoff and at halftime so Undo never reaches back across them.
function pushHist() { S.history.push({ lineup: S.lineup.slice(), formation: S.settings.formation }); if (S.history.length > 25) S.history.shift(); }
// Whoever is in goal during a live half is that half's goalie (an injury swap, or undoing one), so the summary and the 2nd-half "same goalie" check stay right.
function syncGoalie() { if (!immediate() && S.lineup[0]) S.goalies[S.half] = S.lineup[0]; }
function place(pid, i) { const at = S.lineup.indexOf(pid); if (at >= 0) S.lineup[at] = null; S.lineup[i] = pid; }
function addPlayers(names) {
  for (const raw of names) {
    const name = raw.trim().slice(0, 24); if (!name) continue;
    const id = 'p' + S.nextId++;
    S.players.push({ id, name, present: true, prefs: [] }); st(id);
  }
}

/* ---------------- Audio, haptics, wake lock ---------------- */
let actx = null;
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // lets sound play with the iPhone ring switch on silent (iOS 17+)
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    wakeAudio();
  } catch (e) { /* no audio */ }
}
// Locking the phone or switching apps suspends the context (iOS reports "interrupted"); wake it whenever it is not running.
function wakeAudio() {
  try { if (actx && actx.state !== 'running') return actx.resume().catch(() => { /* needs a tap first */ }); } catch (e) { /* no audio */ }
}
let beepWaiting = false;
function beep(n = 3, freq = 880) {
  if (!actx) return;
  if (actx.state === 'running') { playTones(n, freq); return; }
  // Tones scheduled on a frozen clock never sound, so wake the context first and play once it runs. One wake-up at a time, so a slow resume can't stack beeps.
  if (beepWaiting) return;
  beepWaiting = true;
  actx.resume().then(() => { if (actx.state === 'running') playTones(n, freq); }).catch(() => { /* needs a tap first */ }).finally(() => { beepWaiting = false; });
}
function playTones(n, freq) {
  const t0 = actx.currentTime;
  for (let k = 0; k < n; k++) {
    const t = t0 + k * 0.3, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.22);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.25);
  }
}
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* unsupported */ } };
let wl = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* denied */ }
}

/* ---------------- Clock ---------------- */
function tick() {
  const now = Date.now(), d = Math.max(0, now - S.lastTick);
  S.lastTick = now;
  if (S.phase === 'game' && S.halfState === 'running' && d > 0) {
    S.clockMs += d; S.gameMs = (S.gameMs || 0) + d;
    for (const p of present()) { const s = st(p.id); if (S.lineup.includes(p.id)) s.played += d; else s.bench += d; }
    if (S.sub.state === 'running') {
      S.sub.ms += d;
      if (S.sub.ms >= subMs()) { S.sub.state = 'due'; S.sub.silenced = false; lastDueBeep = now; beep(3); vibrate([400, 150, 400, 150, 400]); needsRender = true; }
    } else if (S.sub.state === 'due') {
      S.sub.ms += d;
      if (!S.sub.silenced && now - lastDueBeep > 12000) { lastDueBeep = now; beep(2); vibrate([300, 120, 300]); }
    }
    if (!S.halfAlerted && S.clockMs >= halfMs()) { S.halfAlerted = true; beep(2, 660); vibrate([700, 200, 700]); toast('Time is up — end the half when the ref does.'); needsRender = true; }
  }
  if (needsRender && !(drag && drag.active)) { needsRender = false; render(); } else paintLive();
  if (now - lastSave > 1000) { save(); lastSave = now; }
}
function setText(sel, txt) { const e = $(sel); if (e && e.textContent !== txt) e.textContent = txt; }
function paintLive() {
  if (S.phase !== 'game') return;
  const rem = halfMs() - S.clockMs;
  setText('[data-clock]', rem >= 0 ? fmt(rem, true) : '+' + fmt(-rem));
  const c = $('[data-clock]'); if (c) c.classList.toggle('over', rem < 0);
  setText('[data-elapsed]', fmt(S.clockMs) + ' played');
  if (S.sub.state === 'running') {
    const left = Math.max(0, subMs() - S.sub.ms);
    setText('[data-subtime]', fmt(left, true));
    const a = $('[data-subarc]');
    if (a) { a.setAttribute('stroke-dasharray', arcDash(left / subMs())); a.classList.toggle('hot', left <= 30000); }
  } else if (S.sub.state === 'due') setText('[data-subover]', '+' + fmt(S.sub.ms - subMs()));
  const avg = avgPlayed();
  document.querySelectorAll('[data-ring]').forEach(r => {
    const id = r.dataset.ring, p = ringPct(id).toFixed(1), cls = ('ring ' + ringCls(id, avg)).trim();
    if (r.dataset.p !== p) { r.dataset.p = p; r.style.setProperty('--p', p); }
    if (r.className !== cls) r.className = cls;
  });
  document.querySelectorAll('[data-badge]').forEach(b => {
    const id = b.dataset.badge, f = fairness(id, avg), v = f + '|' + chipInner(id, f);
    if (b.dataset.v !== v) { b.dataset.v = v; b.innerHTML = chipInner(id, f); b.className = ('mn ' + f).trim(); }
  });
  document.querySelectorAll('[data-wait]').forEach(w => setText2(w, waitText(w.dataset.wait)));
}
const setText2 = (e, txt) => { if (e.textContent !== txt) e.textContent = txt; };

/* ---------------- Rendering ---------------- */
// Pick readable text for the kit color, and a keeper color that never matches the kit (yellow, or magenta if the kit is yellow/green).
function applyKit() {
  const hex = S.settings.color, n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hue = 0;
  if (mx !== mn) { const d = mx - mn; hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue = (hue * 60 + 360) % 360; }
  const clash = mx - mn > 40 && hue >= 40 && hue <= 170;
  const root = document.documentElement.style;
  root.setProperty('--kit', hex);
  root.setProperty('--kit-ink', lum > 0.55 ? '#0E1A2B' : '#fff');
  root.setProperty('--gk', clash ? '#E6007E' : '#F4C430');
  root.setProperty('--gk-ink', clash ? '#fff' : '#1A1400');
}

// Re-rendering swaps the DOM, which would empty half-typed text in the add / paste / late-arrival forms.
// Carry each named field's value, focus and cursor across the repaint.
function keepFields(scope, paint) {
  const saved = {}, active = document.activeElement;
  let focus = null;
  const each = fn => scope.querySelectorAll('form[data-form]').forEach(f => [...f.elements].forEach(el => { if (el.name) fn(f.dataset.form + ':' + el.name, el); }));
  each((key, el) => { saved[key] = el.value; if (el === active) focus = { key, from: el.selectionStart, to: el.selectionEnd }; });
  paint();
  each((key, el) => {
    if (!(key in saved)) return;
    el.value = saved[key];
    if (focus && focus.key === key) { el.focus(); try { el.setSelectionRange(focus.from, focus.to); } catch (e) { /* not a text field */ } }
  });
  scope.querySelectorAll('select[name=pid]').forEach(s => { s.form.elements.n.hidden = s.value !== '__new'; }); // the "new player" box only shows for that option
}
// Skip the repaint when the markup is unchanged (the clock ticking behind an open sheet), so typing, focus and scroll survive.
function paintInto(el, html) {
  if (el._html === html) return;
  el._html = html;
  keepFields(el, () => { el.innerHTML = html; });
}

function render() {
  const app = $('#app'), sc = $('.scroll'), top = sc ? sc.scrollTop : 0;
  applyKit();
  keepFields(app, () => { app.innerHTML = S.phase === 'setup' ? setupHTML() : S.phase === 'summary' ? summaryHTML() : gameHTML(); });
  const sc2 = $('.scroll'); if (sc2) sc2.scrollTop = top;
  renderSheet();
  if (UI.focusAdd) { UI.focusAdd = false; const i = $('#addname'); if (i) i.focus(); }
  paintLive();
}

function segMin(cur) {
  return `<div class="seg" role="group" aria-label="Minutes between subs">${[3, 4, 5, 6, 7].map(n =>
    `<button data-act="setSubMin" data-n="${n}" aria-pressed="${n === cur}">${n}</button>`).join('')}</div>`;
}
function formationSeg() {
  return `<div class="seg wrap" role="group" aria-label="Formation">${Object.keys(FORMATIONS).map(f =>
    `<button data-act="setFormation" data-f="${f}" aria-pressed="${f === S.settings.formation}">${f}</button>`).join('')}</div>`;
}
function swatches() {
  return `<div class="swatches">${COLORS.map(c =>
    `<button class="swatch" style="background:${c}" data-act="setColor" data-c="${c}" aria-pressed="${c === S.settings.color}" aria-label="Kit color ${c}"></button>`).join('')}</div>`;
}
function halfStepper() {
  return `<div class="stepper"><button data-act="halfDown" aria-label="Shorter half">−</button><output>${S.settings.halfMin} min</output><button data-act="halfUp" aria-label="Longer half">+</button></div>`;
}
function switchBtn(on, act, label) { return `<button class="switch" role="switch" aria-pressed="${on}" aria-label="${label}" data-act="${act}"></button>`; }

function setupHTML() {
  const here = present().length, total = S.players.length;
  const rows = S.players.map(p => `
    <li class="prow ${p.present ? 'here' : 'away'}">
      <div class="pline">
        <button class="here-toggle" data-act="togglePresent" data-pid="${p.id}" aria-pressed="${p.present}"><span class="chk"></span><span class="pname">${esc(p.name)}</span></button>
        <button class="posbtn ${p.prefs.length ? 'has' : ''}" data-act="openPrefs" data-pid="${p.id}" aria-expanded="${UI.openPrefs === p.id}">${p.prefs.length ? p.prefs.map(r => ROLE_LABEL[r]).join(' ') : 'Positions'}</button>
        <button class="x" data-act="remove" data-pid="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>
      </div>
      ${UI.openPrefs === p.id ? `<div class="prefgrid" role="group" aria-label="Positions ${esc(p.name)} likes">${ROLES.map(r =>
        `<button class="pref ${p.prefs.includes(r) ? 'on' : ''}" data-act="togglePref" data-pid="${p.id}" data-role="${r}" aria-pressed="${p.prefs.includes(r)}">${ROLE_TITLE[r]}</button>`).join('')}</div>` : ''}
    </li>`).join('');
  const list = total ? `<ul class="plist">${rows}</ul>
      <p class="hintline">Tap a name when a player is absent today. Tap Positions to mark where a player likes to play (goalie, defense, midfield, left wing, right wing, forward). It's optional, and it only highlights spots — you still choose.</p>`
    : `<div class="empty-state"><strong>No players yet.</strong> Type a name above and tap Add, or paste your whole roster in one go.
       <br><button class="linkbtn" data-act="sample">Load a sample roster to try the app</button></div>`;
  const note = here === 0 ? 'Add at least one player to continue.' : here < 11 ? `Only ${here} here — you'll play short.` : here === 11 ? 'Exactly 11 — no subs available.' : `${here - 11} on the bench at kickoff.`;
  return `<div class="setup"><div class="scroll">
    <h1>Game day</h1>
    <p class="lede">Pick who showed up, set the game, then place your starters.</p>
    <h2>Who's here today</h2>
    <form class="addrow" data-form="add" autocomplete="off">
      <input id="addname" name="n" placeholder="Player name" enterkeyhint="done" autocapitalize="words" aria-label="Player name">
      <button class="btn" type="submit">Add</button>
    </form>
    <button class="linkbtn" data-act="pasteToggle">${UI.paste ? 'Hide paste box' : 'Paste a list of names'}</button>
    <button class="linkbtn" data-act="restoreTeam" style="margin-left:16px">Reset to full team</button>
    ${UI.paste ? `<form class="paste" data-form="paste"><textarea name="t" placeholder="One name per line, or separated by commas" aria-label="List of names"></textarea><button class="btn wide" type="submit">Add these players</button></form>` : ''}
    <div class="count"><span>${here} here</span><small>${total} on the list${total - here ? ` · ${total - here} absent` : ''}</small></div>
    ${list}
    <h2>Game settings</h2>
    <div class="panel">
      <div class="field-row"><div class="lbl">Formation</div></div>
      <div class="field-row" style="padding-top:0">${formationSeg()}</div>
      <div class="field-row"><div class="lbl">Half length</div>${halfStepper()}</div>
      <div class="field-row"><div class="lbl">Minutes between subs<small>You start the timer each time.</small></div>${segMin(S.settings.subMin)}</div>
      <div class="field-row"><div class="lbl">Restart sub timer after each sub<small>Also starts it at kickoff.</small></div>${switchBtn(S.settings.autoStart, 'toggleAuto', 'Restart sub timer automatically')}</div>
      <div class="field-row"><div class="lbl">Kit color</div>${swatches()}</div>
    </div>
  </div>
  <div class="cta"><p class="note">${note}</p><button class="btn go" data-act="toLineup" ${here ? '' : 'disabled'}>Set the lineup</button></div></div>`;
}

// Ring badge helpers: the ring fills with a player's share of the game on the field; colour comes from fairness().
const gameMs = () => Math.max(S.gameMs || 0, S.clockMs);
const ringPct = id => { const g = gameMs(); return g ? Math.min(100, st(id).played / g * 100) : 100; };
const ringCls = (id, avg) => gameMs() ? fairness(id, avg) : 'plain';
const chipInner = (id, f) => mins(st(id).played) + '′' + (f ? `<small>${f === 'ahead' ? '▲' : '▼'}</small>` : '');
const chipHTML = (id, avg) => { if (S.halfState === 'ready' && !st(id).played) return ''; const f = fairness(id, avg); return `<i class="mn ${f}" data-badge="${id}">${chipInner(id, f)}</i>`; };
const waitText = id => S.halfState === 'ready' && !st(id).bench ? 'Bench' : mins(st(id).bench) + 'm wait';
const arcDash = frac => `${(CIRC * Math.max(0, Math.min(1, frac))).toFixed(1)} ${CIRC.toFixed(1)}`;

// Half clock and sub timer in one card; the ring is the sub timer (tap to start, tap to silence when due).
function hudHTML() {
  const ready = immediate(), running = S.halfState === 'running', sub = S.sub, due = sub.state === 'due';
  const need = Math.min(11, present().length), left = need - S.lineup.filter(Boolean).length;
  const pickGK = ready && S.half === 2 && !S.lineup[0];
  const lineupStatus = pickGK ? '<b class="need">Pick a goalie</b>' : left > 0 ? `<b class="need">${left} left to place</b>` : '<b class="done">Lineup set</b>';
  const status = ready ? lineupStatus : running ? 'Live' : 'Paused';
  const half = S.half === 1 ? '1st' : '2nd';
  const label = due ? `Sub time · ${half} half` : `${half} half · ${status}`;
  const track = '<circle class="track" cx="48" cy="48" r="40"/>';
  let ring;
  if (ready) {
    ring = `<div class="ringface" role="img" aria-label="${S.settings.subMin} minutes between subs"><svg viewBox="0 0 96 96" aria-hidden="true">${track}</svg><span class="mid"><b>${S.settings.subMin}:00</b><small>per sub</small></span></div>`;
  } else if (sub.state === 'idle') {
    ring = `<button class="ringface" data-act="subStart" aria-label="Start sub timer" ${running ? '' : 'disabled'}><svg viewBox="0 0 96 96" aria-hidden="true"><circle class="dash" cx="48" cy="48" r="40"/></svg><span class="mid">${PLAY}<small>Start<span class="lg"> subs</span></small></span></button>`;
  } else if (sub.state === 'running') {
    const frac = (subMs() - sub.ms) / subMs();
    ring = `<div class="ringface"><svg viewBox="0 0 96 96" aria-hidden="true">${track}<circle class="arc${frac * subMs() <= 30000 ? ' hot' : ''}" data-subarc cx="48" cy="48" r="40" stroke-dasharray="${arcDash(frac)}"/></svg><span class="mid"><b data-subtime>${fmt(subMs() - sub.ms, true)}</b><small>next<span class="lg"> subs</span></small></span></div>
      <button class="reset" data-act="subReset" aria-label="Reset sub timer">↻</button>`;
  } else {
    ring = `<button class="ringface" data-act="${sub.silenced ? 'subReset' : 'subSilence'}" aria-label="${sub.silenced ? 'Reset sub timer' : 'Silence the alert'}"><svg viewBox="0 0 96 96" aria-hidden="true">${track}<circle class="arc" cx="48" cy="48" r="40" stroke-dasharray="${arcDash(1)}"/></svg><span class="mid"><b data-subover>+0:00</b><small>${sub.silenced ? 'Reset' : 'Silence'}</small></span></button>
      <button class="reset" data-act="subReset" aria-label="Reset sub timer">↻</button>`;
  }
  const chip = ready || sub.state === 'idle' ? `<button class="chip" data-act="menu" aria-label="Change minutes between subs">Every ${S.settings.subMin} min ▾</button>` : '';
  return `<section class="hud${running ? ' live' : ''}${due ? ' due' : ''}">
    <div class="hudl"><div class="halflabel"><span class="livedot"></span>${label}</div>
      <div class="clock" data-clock>${fmt(halfMs(), true)}</div>
      <div class="elapsed"><span data-elapsed>0:00 played</span>${chip}</div></div>
    <div class="subring">${ring}</div></section>`;
}

// Chips for queued subs during a half; quick actions while setting the lineup before kickoff.
function trayHTML() {
  const np = UI.pending.length, sel = UI.sel;
  if (np) {
    return `<div class="tray">${UI.pending.map((p, k) => `<span class="q"><span><i class="qd"></i>${esc(P(p.off).name)}</span><b>⇄</b><span><i class="qd on"></i>${esc(P(p.on).name)}</span><button class="qx" data-act="unqueue" data-k="${k}" aria-label="Remove this sub">✕</button></span>`).join('')}</div>`;
  }
  if (!immediate()) return '';
  const parts = [];
  if (sel && sel.kind === 'spot' && S.lineup[sel.v]) parts.push('<button class="pill primary" data-act="toBench">Move to bench</button>');
  else {
    if (S.lineup.some(x => !x) && benchPlayers().length) parts.push('<button class="pill primary" data-act="autofill">Auto-fill by position</button>');
    if (S.lineup.some(x => x)) parts.push('<button class="pill" data-act="clearField">Clear field</button>');
  }
  return parts.length ? `<div class="tray">${parts.join('')}</div>` : '';
}

function dockHTML() {
  const np = UI.pending.length, ready = immediate(), running = S.halfState === 'running';
  const over = running && halfMs() - S.clockMs < 0;
  let main;
  if (np) main = `<button class="dmain go" data-act="confirmSubs">Make ${np} sub${np > 1 ? 's' : ''}</button>`;
  else if (ready) main = `<button class="dmain go" data-act="kickoff">Kick off${S.half === 2 ? ' 2nd half' : ''}</button>`;
  else if (over) main = '<button class="dmain flare" data-act="endHalf">End half</button>';
  else if (running) main = `<button class="dmain" data-act="pause">${PAUSE}Pause clock</button>`;
  else main = `<button class="dmain go" data-act="resume">${PLAY}Resume clock</button>`;
  const left = np ? '<button class="dbtn" data-act="clearPending" aria-label="Clear queued subs">✕</button>'
    : `<button class="dbtn" data-act="undo" aria-label="Undo last lineup change" ${S.history.length ? '' : 'disabled'}>↶</button>`;
  const items = [];
  if (over) items.push('<button data-act="moreDo" data-fn="pause">Pause clock</button>');
  else if (!ready) items.push('<button data-act="moreDo" data-fn="endHalf">End half</button>');
  items.push('<button data-act="moreDo" data-fn="menu">Game settings</button>', '<button data-act="moreDo" data-fn="lateOpen">Late arrival</button>', '<button class="dng" data-act="moreDo" data-fn="newGame">End game…</button>');
  return `<div class="dockwrap">${UI.more ? `<div class="more" role="menu">${items.join('')}</div>` : ''}
    <nav class="dock">${left}${main}<button class="dbtn" data-act="more" aria-label="More options" aria-expanded="${UI.more}">•••</button></nav></div>`;
}

function gameHTML() {
  const sp = spots(), avg = avgPlayed();
  const sel = UI.sel;
  const selPlayerPrefs = sel && sel.kind === 'bench' ? (P(sel.v) || { prefs: [] }).prefs : null;
  const selSpotRole = sel && sel.kind === 'spot' ? sp[sel.v][0] : null;

  // ----- field tokens
  const field = sp.map((s, i) => {
    const pid = S.lineup[i], pos = `left:${s[1]}%;top:${s[2]}%`;
    const isSel = sel && sel.kind === 'spot' && sel.v === i;
    const pref = selPlayerPrefs && selPlayerPrefs.includes(s[0]) ? ' pref' : '';
    if (!pid) return `<button class="tok empty${isSel ? ' sel' : ''}${pref}" style="${pos}" data-act="spot" data-i="${i}" aria-label="Empty ${ROLE_NAME[s[0]]} spot"><span class="ring empty"><span class="disc">${ROLE_LABEL[s[0]]}</span></span></button>`;
    const p = P(pid), pi = pairIdx(pid);
    const cls = ['tok', s[0] === 'GK' ? 'gk' : '', isSel ? 'sel' : '', pi >= 0 ? 'off' : '', pref.trim()].filter(Boolean).join(' ');
    const lock = s[0] === 'GK' && !immediate() ? LOCK : '';
    const incoming = pi >= 0 ? `<i class="incoming">⇄ ${esc(initials(P(UI.pending[pi].on).name))}</i>` : '';
    return `<button class="${cls}" style="${pos}" data-act="spot" data-i="${i}" aria-label="${esc(p.name)}, ${ROLE_NAME[s[0]]}"><span class="ring ${ringCls(pid, avg)}" data-ring="${pid}" style="--p:${ringPct(pid).toFixed(1)}"><span class="disc">${esc(initials(p.name))}</span>${chipHTML(pid, avg)}${lock}${incoming}</span><span class="nm">${esc(p.name)}</span></button>`;
  }).join('');

  // ----- bench
  const bench = benchPlayers().map(p => {
    const pi = pairIdx(p.id), isSel = sel && sel.kind === 'bench' && sel.v === p.id;
    const star = selSpotRole && p.prefs.includes(selSpotRole) ? '<i class="star" aria-label="likes this position">★</i>' : '';
    const sub = pi >= 0 ? `⇄ ${esc(P(UI.pending[pi].off).name.split(' ')[0])}` : `<span data-wait="${p.id}">${waitText(p.id)}</span>`;
    return `<button class="bcard${isSel ? ' sel' : ''}${pi >= 0 ? ' queued' : ''}" data-act="bench" data-pid="${p.id}" aria-label="${esc(p.name)} on the bench"><span class="ring ${ringCls(p.id, avg)}" data-ring="${p.id}" style="--p:${ringPct(p.id).toFixed(1)}"><span class="disc">${esc(initials(p.name))}</span></span><span class="btxt"><b>${esc(p.name)}</b><small>${sub}</small></span>${star}</button>`;
  }).join('');

  const benchHint = immediate() ? 'Drag or tap a player to a spot' : 'Longest wait first';
  const legend = immediate() ? '' : '<span class="legend"><i style="background:var(--owed)"></i>behind<i style="background:var(--ahead)"></i>ahead</span>';
  return `<div class="game">${hudHTML()}
    <div class="pitchwrap"><div class="pitch">${pitchSVG()}${field}</div></div>
    <div class="side">${trayHTML()}
      <div class="benchbox"><div class="benchhead"><span>Bench (${benchPlayers().length})</span><small>${benchHint}${legend}</small></div>
        <div class="bgrid${benchPlayers().length > 5 ? ' many' : ''}">${bench}<button class="bcard late" data-act="lateOpen">+ Late arrival</button></div></div>
      ${dockHTML()}</div>
    ${UI.more ? '<div class="morescrim" data-act="closeMore"></div>' : ''}</div>`;
}

function pitchSVG() {
  return `<svg viewBox="0 0 78 100" aria-hidden="true">
    <rect x="2" y="2" width="74" height="96"/><line x1="2" y1="50" x2="76" y2="50"/>
    <circle cx="39" cy="50" r="9"/><circle class="dot" cx="39" cy="50" r=".8"/>
    <rect x="22" y="2" width="34" height="16"/><rect x="31" y="2" width="16" height="6"/>
    <path d="M31.5 18 A9 9 0 0 0 46.5 18"/>
    <rect x="22" y="82" width="34" height="16"/><rect x="31" y="92" width="16" height="6"/>
    <path d="M31.5 82 A9 9 0 0 1 46.5 82"/></svg>`;
}

function summaryHTML() {
  const rows = present().slice().sort((a, b) => st(b.id).played - st(a.id).played);
  const max = Math.max(1, ...rows.map(p => st(p.id).played));
  const total = rows.reduce((a, p) => a + st(p.id).played, 0), avg = rows.length ? total / rows.length : 0;
  return `<div class="setup summary"><div class="scroll">
    <h1>Full time</h1>
    <p class="lede">Average playing time was ${mins(avg)} min. Here is how the minutes landed.</p>
    ${[1, 2].some(h => S.goalies[h] && P(S.goalies[h])) ? `<p class="lede" style="margin-top:-10px">${[1, 2].filter(h => S.goalies[h] && P(S.goalies[h])).map(h => `${h === 1 ? '1st' : '2nd'} half goalie: <strong>${esc(P(S.goalies[h]).name)}</strong>`).join(', ')}</p>` : ''}
    <div class="list">${rows.map(p => `<div class="row"><span class="nm2">${esc(p.name)}</span><span class="mins">${mins(st(p.id).played)} min<small>${mins(st(p.id).bench)} on bench</small></span><div class="bar"><i style="width:${st(p.id).played / max * 100}%"></i></div></div>`).join('')}</div>
  </div><div class="cta"><button class="btn go" data-act="newGame">Start a new game</button><div style="height:8px"></div><button class="btn ghost" data-act="reopen">Reopen this game</button></div></div>`;
}

const confirmGoalie = pid => ask({ title: 'Swap the goalie?', body: `${P(pid).name} is the goalie for this half. Only swap for an injury or if she asks.`, ok: 'Swap goalie', cancel: 'Keep her in goal' });
const LOCK = '<i class="lock" aria-label="Goalie for this half"><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="6" rx="1.2"/><path d="M4 5.5V4a2 2 0 014 0v1.5"/></svg></i>';
const PLAY = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="4.5" height="15" rx="1.2"/><rect x="14" y="4.5" width="4.5" height="15" rx="1.2"/></svg>';
function lateOptions() { return S.players.filter(p => !p.present); }
function lateFormHTML() {
  const absent = lateOptions();
  if (!absent.length) return `<form class="latefm" data-form="late" autocomplete="off"><div class="addrow"><input name="n" placeholder="New player's name" aria-label="New player's name" autocapitalize="words"><button class="btn" type="submit">Add to bench</button></div></form>`;
  return `<form class="latefm" data-form="late" autocomplete="off"><div class="addrow">
    <select name="pid" aria-label="Player who arrived late"><option value="">Choose a player</option>${absent.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}<option value="__new">Someone not on the roster…</option></select>
    <button class="btn" type="submit">Add to bench</button></div>
    <input class="newname" name="n" placeholder="New player's name" aria-label="New player's name" autocapitalize="words" hidden></form>`;
}

function renderSheet() {
  const root = $('#sheet-root'), dlg = $('#dlg-root');
  paintInto(root, UI.menu && S.phase === 'game' ? `<div class="scrim" data-act="closeMenu"><div class="sheet" role="dialog" aria-label="Game settings" data-stop>
    <header><h2>Game settings</h2><button class="btn ghost small" data-act="closeMenu">Done</button></header>
    <div class="panel">
      <div class="field-row"><div class="lbl">Minutes between subs</div>${segMin(S.settings.subMin)}</div>
      <div class="field-row"><div class="lbl">Restart sub timer after each sub</div>${switchBtn(S.settings.autoStart, 'toggleAuto', 'Restart sub timer automatically')}</div>
      <div class="field-row"><div class="lbl">Half length</div>${halfStepper()}</div>
      <div class="field-row"><div class="lbl">Kit color</div>${swatches()}</div>
    </div>
    <div class="panel"><div class="field-row"><div class="lbl">Formation<small>Players keep their position group when you switch.</small></div></div><div class="field-row" style="padding-top:0">${formationSeg()}</div></div>
    <div class="panel"><div class="field-row"><div class="lbl">Late arrival<small>${lateOptions().length ? 'Pick who just showed up.' : 'Everyone on the roster is here. Add someone new:'}</small></div></div>
      ${lateFormHTML()}</div>
    <button class="btn danger wide" data-act="newGame">End game and start over</button>
  </div></div>` : '');
  const d = UI.dlg;
  paintInto(dlg, d ? `<div class="scrim dlg"><div class="dialog" role="alertdialog" aria-labelledby="dt"><h3 id="dt">${esc(d.title)}</h3><p>${esc(d.body)}</p>
    <div class="row"><button class="btn ghost" data-act="dlgNo">${esc(d.cancel)}</button><button class="btn ${d.danger ? 'danger' : 'go'}" data-act="dlgYes">${esc(d.ok)}</button></div></div></div>` : '');
}

/* ---------------- Dialog + toast ---------------- */
// Resolves true / false from the buttons. A dialog replaced by a newer one resolves null, so its caller is never left waiting;
// callers where "cancel" means "go ahead" must test `=== false` rather than falsiness.
function ask(o) { return new Promise(res => { if (UI.dlg) UI.dlg.res(null); UI.dlg =Object.assign({ ok: 'OK', cancel: 'Cancel', danger: false }, o, { res }); renderSheet(); }); }
let toastTimer = 0;
function toast(msg, withUndo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${withUndo ? '<button data-act="undo">Undo</button>' : ''}`;
  t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), withUndo ? 9000 : 4000);
}

/* ---------------- Actions ---------------- */
const H = {
  // setup
  restoreTeam() {
    const have = new Set(S.players.map(p => p.name));
    addPlayers(TEAM.filter(n => !have.has(n))); S.players.forEach(p => { if (TEAM.includes(p.name)) p.present = true; }); commit();
  },
  sample() { addPlayers(SAMPLE); const find = n => S.players.find(p => p.name === n); find('Hazel').prefs = ['GK']; find('Piper').prefs = ['GK', 'DEF']; find('Ava').prefs = ['FWD']; commit(); },
  pasteToggle() { UI.paste = !UI.paste; commit(); },
  togglePresent(t) { const p = P(t.dataset.pid); p.present = !p.present; commit(); },
  openPrefs(t) { UI.openPrefs = UI.openPrefs === t.dataset.pid ? null : t.dataset.pid; commit(); },
  togglePref(t) { const p = P(t.dataset.pid), r = t.dataset.role; p.prefs = p.prefs.includes(r) ? p.prefs.filter(x => x !== r) : p.prefs.concat(r); commit(); },
  remove(t) { const id = t.dataset.pid; S.players = S.players.filter(p => p.id !== id); delete S.stats[id]; commit(); },
  setFormation(t) { changeFormation(t.dataset.f); },
  setSubMin(t) { S.settings.subMin = +t.dataset.n; commit(); },
  halfUp() { S.settings.halfMin = Math.min(60, S.settings.halfMin + 5); commit(); },
  halfDown() { S.settings.halfMin = Math.max(10, S.settings.halfMin - 5); commit(); },
  toggleAuto() { S.settings.autoStart = !S.settings.autoStart; commit(); },
  setColor(t) { S.settings.color = t.dataset.c; commit(); },
  toLineup() { unlockAudio(); S.phase = 'game'; S.halfState = 'ready'; S.half = 1; S.clockMs = 0; UI.sel = null; UI.pending = []; commit(); },

  // lineup + subs
  async spot(t) {
    const i = +t.dataset.i, pid = S.lineup[i], sel = UI.sel;
    if (!immediate() && i === 0 && pid && pairIdx(pid) < 0 && !(await confirmGoalie(pid))) { UI.sel = null; commit(); return; }
    if (immediate()) {
      if (!sel) UI.sel = { kind: 'spot', v: i };
      else if (sel.kind === 'spot') {
        if (sel.v === i) UI.sel = null;
        else { pushHist(); [S.lineup[i], S.lineup[sel.v]] = [S.lineup[sel.v], S.lineup[i]]; UI.sel = null; }
      } else { pushHist(); place(sel.v, i); UI.sel = null; }
    } else {
      const pi = pairIdx(pid);
      if (pid && sel && sel.kind === 'spot' && sel.v !== i) {
        // Moving one field player onto another swaps their spots. Queued subs are tracked by player, so they follow along (and are not cancelled).
        pushHist(); [S.lineup[i], S.lineup[sel.v]] = [S.lineup[sel.v], S.lineup[i]]; UI.sel = null;
      }
      else if (pid && pi >= 0) UI.pending.splice(pi, 1);
      else if (!pid) { if (sel && sel.kind === 'bench') { pushHist(); place(sel.v, i); UI.sel = null; } }
      else if (sel && sel.kind === 'bench') { UI.pending.push({ off: pid, on: sel.v }); UI.sel = null; }
      else if (sel && sel.kind === 'spot') UI.sel = null; // the selected spot tapped again
      else UI.sel = { kind: 'spot', v: i };
    }
    syncGoalie(); commit();
  },
  bench(t) {
    const pid = t.dataset.pid, sel = UI.sel;
    if (immediate()) {
      if (sel && sel.kind === 'spot') { pushHist(); place(pid, sel.v); UI.sel = null; }
      else UI.sel = sel && sel.kind === 'bench' && sel.v === pid ? null : { kind: 'bench', v: pid };
    } else {
      const pi = pairIdx(pid);
      if (pi >= 0) UI.pending.splice(pi, 1);
      else if (sel && sel.kind === 'spot' && S.lineup[sel.v]) { UI.pending.push({ off: S.lineup[sel.v], on: pid }); UI.sel = null; }
      else UI.sel = sel && sel.kind === 'bench' && sel.v === pid ? null : { kind: 'bench', v: pid };
    }
    commit();
  },
  confirmSubs() {
    if (!UI.pending.length) return;
    pushHist(); const n = UI.pending.length;
    for (const { off, on } of UI.pending) { const i = S.lineup.indexOf(off); if (i >= 0) S.lineup[i] = on; }
    UI.pending = []; UI.sel = null; syncGoalie();
    S.sub = { state: S.settings.autoStart && S.halfState === 'running' ? 'running' : 'idle', ms: 0, silenced: false };
    commit(); toast(`${n} sub${n > 1 ? 's' : ''} made`, true);
  },
  clearPending() { UI.pending = []; UI.sel = null; commit(); },
  unqueue(t) { UI.pending.splice(+t.dataset.k, 1); commit(); },
  toBench() { if (UI.sel && UI.sel.kind === 'spot') { pushHist(); S.lineup[UI.sel.v] = null; UI.sel = null; commit(); } },
  autofill() {
    // Match as many position preferences as possible (so a player tagged for two spots can't block someone tagged for one),
    // handling scarce spots (GK, wings) first; everyone left over fills the remaining spots.
    pushHist();
    const sp = spots(), free = present().filter(p => !S.lineup.includes(p.id));
    const empty = sp.map((s, i) => i).filter(i => !S.lineup[i]);
    const prio = { GK: 0, LW: 1, RW: 2, FWD: 3, MID: 4, DEF: 5 };
    const prevGK = S.half === 2 ? S.goalies[1] : null;
    const cands = i => free.filter(p => p.prefs.includes(sp[i][0]) && !(sp[i][0] === 'GK' && p.id === prevGK)).sort((a, b) => a.prefs.length - b.prefs.length || st(a.id).played - st(b.id).played);
    const order = empty.filter(i => cands(i).length).sort((a, b) => cands(a).length - cands(b).length || prio[sp[a][0]] - prio[sp[b][0]] || a - b);
    const owner = {}; // player id -> spot index
    const assign = (i, seen) => {
      for (const p of cands(i)) {
        if (seen.has(p.id)) continue; seen.add(p.id);
        if (owner[p.id] === undefined || assign(owner[p.id], seen)) { owner[p.id] = i; return true; }
      }
      return false;
    };
    order.forEach(i => assign(i, new Set()));
    for (const [pid, i] of Object.entries(owner)) S.lineup[i] = pid;
    const rest = free.filter(p => !S.lineup.includes(p.id)).sort((a, b) => st(a.id).played - st(b.id).played);
    sp.forEach((s, i) => { if (!S.lineup[i] && rest.length) { const k = s[0] === 'GK' && rest.length > 1 && rest[0].id === prevGK ? 1 : 0; S.lineup[i] = rest.splice(k, 1)[0].id; } });
    commit();
  },
  clearField() { pushHist(); S.lineup = Array(11).fill(null); UI.sel = null; commit(); },
  undo() {
    const h = S.history.pop(); if (!h) return;
    // Games saved by an earlier build stored a bare lineup array
    S.lineup = Array.isArray(h) ? h : h.lineup;
    if (!Array.isArray(h) && FORMATIONS[h.formation]) S.settings.formation = h.formation;
    UI.sel = null; UI.pending = []; syncGoalie(); commit();
  },

  // clock
  async kickoff() {
    unlockAudio();
    const need = Math.min(11, present().length), have = S.lineup.filter(Boolean).length;
    if (!S.lineup[0] && need) { if ((await ask({ title: 'No goalie yet', body: `Choose who plays goalie in the ${S.half === 1 ? '1st' : '2nd'} half, then kick off.`, ok: 'Pick a goalie', cancel: 'Kick off anyway' })) !== false) return; }
    else if (S.half === 2 && S.goalies[1] && S.lineup[0] === S.goalies[1]) {
      if ((await ask({ title: 'Same goalie?', body: `${P(S.goalies[1]).name} played goalie in the 1st half. Start her in goal again?`, ok: 'Pick someone else', cancel: 'Same goalie' })) !== false) return;
    }
    if (have < need && !(await ask({ title: 'Lineup not full', body: `Only ${have} of ${need} spots are filled. Kick off anyway?`, ok: 'Kick off' }))) return;
    S.goalies[S.half] = S.lineup[0] || null;
    S.history = []; // Undo only reaches back to the start of play
    S.halfState = 'running'; S.lastTick = Date.now(); S.halfAlerted = false; UI.sel = null; UI.pending = [];
    S.sub = { state: S.settings.autoStart ? 'running' : 'idle', ms: 0, silenced: false };
    keepAwake(); commit();
  },
  pause() { tick(); S.halfState = 'paused'; UI.sel = null; commit(); },
  resume() { unlockAudio(); S.lastTick = Date.now(); S.halfState = 'running'; keepAwake(); commit(); },
  async endHalf() {
    const first = S.half === 1;
    if (!(await ask({ title: first ? 'End the first half?' : 'End the game?', body: first ? `The clock stops at ${fmt(S.clockMs)}. You can reset your lineup before the second half.` : 'You will see how many minutes each player got.', ok: first ? 'End half' : 'End game' }))) return;
    tick(); UI.sel = null; UI.pending = []; S.sub = { state: 'idle', ms: 0, silenced: false }; S.history = [];
    if (first) { S.half = 2; S.halfState = 'ready'; S.clockMs = 0; S.halfAlerted = false; if (S.lineup[0]) { S.goalies[1] = S.goalies[1] || S.lineup[0]; pushHist(); S.lineup[0] = null; } } else { S.phase = 'summary'; S.halfState = 'paused'; }
    commit();
  },
  reopen() { S.phase = 'game'; S.halfState = 'paused'; S.lastTick = Date.now(); commit(); },

  // sub timer
  subStart() { unlockAudio(); S.sub = { state: 'running', ms: 0, silenced: false }; commit(); },
  subReset() { S.sub = { state: 'idle', ms: 0, silenced: false }; commit(); },
  subSilence() { S.sub.silenced = true; commit(); },

  // menu + dialogs
  menu() { UI.menu = true; renderSheet(); },
  more() { UI.more = !UI.more; render(); },
  closeMore() { UI.more = false; render(); },
  moreDo(t) { const fn = H[t.dataset.fn]; UI.more = false; render(); if (fn) fn(t); }, // dock ••• menu items reuse the regular handlers
  lateOpen() { UI.menu = true; renderSheet(); const f = $('.latefm'); if (f) f.scrollIntoView({ block: 'center' }); },
  closeMenu(t, e) { if (e.target.closest('[data-stop]') && t.classList.contains('scrim')) return; UI.menu = false; renderSheet(); },
  async newGame() {
    UI.menu = false;
    if (!(await ask({ title: 'Start a new game?', body: 'This clears the roster, lineup and minutes played.', ok: 'Clear everything', danger: true }))) { render(); return; }
    const keep = S.settings; S = fresh(); S.settings = keep; UI.sel = null; UI.pending = []; save(); render();
  },
  dlgYes() { const d = UI.dlg; UI.dlg = null; renderSheet(); d.res(true); },
  dlgNo() { const d = UI.dlg; UI.dlg = null; renderSheet(); d.res(false); }
};

function changeFormation(f) {
  if (f === S.settings.formation) return;
  pushHist();
  const oldSp = spots(); S.settings.formation = f;
  const pool = {}; ROLES.forEach(r => { pool[r] = []; });
  S.lineup.forEach((pid, i) => { if (pid) pool[oldSp[i][0]].push(pid); });
  const nl = Array(11).fill(null);
  FORMATIONS[f].forEach((s, i) => { if (pool[s[0]].length) nl[i] = pool[s[0]].shift(); });
  const left = [].concat(...ROLES.map(r => pool[r]));
  nl.forEach((v, i) => { if (!v && left.length) nl[i] = left.shift(); });
  S.lineup = nl; UI.sel = null; UI.pending = [];
  commit();
}

const FORMS = {
  add(f) { addPlayers([f.elements.n.value]); f.reset(); UI.focusAdd = true; commit(); }, // reset, or the kept-field logic would restore the name just added
  paste(f) { addPlayers(f.elements.t.value.split(/[\n,;]+/)); UI.paste = false; commit(); },
  late(f) {
    const sel = f.elements.pid, pid = sel ? sel.value : '__new';
    if (pid && pid !== '__new') {
      const p = P(pid); if (!p) return;
      p.present = true; UI.menu = false; commit(); toast(`${p.name} added to the bench`); return;
    }
    if (sel && !pid) { sel.focus(); return; } // nothing chosen yet
    const name = f.elements.n.value.trim(); if (!name) { f.elements.n.focus(); return; }
    addPlayers([name]); UI.menu = false; commit(); toast(`${name} added to the bench`);
  }
};

/* ---------------- Drag and drop (touch, pen and mouse) ----------------
   A press that barely moves stays a tap. Moving past 10px picks the player up; drop on a field spot, a bench player or the bench. */
function dropTarget(cx, cy) {
  let best = null, bestD = Infinity;
  document.querySelectorAll('.pitch .tok').forEach(t => {
    const r = t.querySelector('.disc').getBoundingClientRect();
    const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
    if (d < bestD && d < r.width * 0.95) { best = { el: t, type: 'spot', i: +t.dataset.i }; bestD = d; }
  });
  if (best) return best;
  const el = document.elementFromPoint(cx, cy);
  const chip = el && el.closest('.bcard[data-act=bench]'); if (chip) return { el: chip, type: 'bench', pid: chip.dataset.pid };
  const box = el && el.closest('.benchbox'); if (box) return { el: box, type: 'benchbox' };
  return null;
}
function ghostPoint(e) { return { x: e.clientX, y: e.clientY - (e.pointerType === 'mouse' ? 0 : 38) }; }
function endDrag() {
  if (!drag) return;
  if (drag.ghost) drag.ghost.remove();
  if (drag.t) drag.t.classList.remove('dragsrc');
  document.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  drag = null;
}
async function performDrop(src, tgt) {
  if (!tgt) return;
  const sub = !immediate();
  if (sub && src.kind === 'spot' && src.i === 0 && !(tgt.type === 'spot' && tgt.i === 0) && !(await confirmGoalie(src.pid))) return;
  if (src.kind === 'spot') {
    if (tgt.type === 'spot') {
      if (tgt.i === src.i) return;
      UI.sel = { kind: 'spot', v: src.i }; H.spot({ dataset: { i: tgt.i } });
    } else if (tgt.type === 'bench') {
      if (sub) UI.pending = UI.pending.filter(p => ![src.pid, tgt.pid].some(x => x === p.off || x === p.on));
      UI.sel = { kind: 'spot', v: src.i }; H.bench({ dataset: { pid: tgt.pid } });
    } else if (tgt.type === 'benchbox') {
      if (sub) { toast('Drop onto a bench player to line up a sub.'); return; }
      pushHist(); S.lineup[src.i] = null; UI.sel = null; commit();
    }
  } else if (src.kind === 'bench') {
    if (tgt.type === 'spot') {
      const occupant = S.lineup[tgt.i];
      if (sub && occupant) UI.pending = UI.pending.filter(p => ![src.pid, occupant].some(x => x === p.off || x === p.on));
      UI.sel = { kind: 'bench', v: src.pid }; H.spot({ dataset: { i: tgt.i } });
    }
  }
}
document.addEventListener('pointerdown', e => {
  if (S.phase !== 'game' || UI.dlg || UI.menu || drag) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const t = e.target.closest('[data-act=spot],[data-act=bench]'); if (!t) return;
  const kind = t.dataset.act === 'bench' ? 'bench' : 'spot';
  const pid = kind === 'bench' ? t.dataset.pid : S.lineup[+t.dataset.i];
  if (!pid) return;
  drag = { t, kind, pid, i: kind === 'spot' ? +t.dataset.i : null, x0: e.clientX, y0: e.clientY, id: e.pointerId, active: false, ghost: null, target: null };
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.active) {
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.hypot(dx, dy) < 10) return;
    const disc = drag.t.querySelector('.disc'), r = disc.getBoundingClientRect();
    const g = document.createElement('div');
    g.className = 'dragghost' + (disc.closest('.tok.gk') ? ' gk' : '');
    g.innerHTML = `<div class="disc" style="--d:${r.width}px">${disc.innerHTML}</div>`;
    document.body.appendChild(g);
    drag.ghost = g; drag.w = r.width; drag.active = true;
    drag.t.classList.add('dragsrc');
    UI.sel = null; try { navigator.vibrate && navigator.vibrate(12); } catch (err) { /* unsupported */ }
  }
  e.preventDefault();
  const p = ghostPoint(e);
  drag.ghost.style.transform = `translate(${p.x - drag.w / 2}px, ${p.y - drag.w / 2}px) scale(1.15)`;
  const tgt = dropTarget(p.x, p.y);
  const el = tgt && tgt.el;
  if (!drag.target || drag.target.el !== el) {
    document.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
    if (el && !(tgt.type === 'spot' && tgt.i === drag.i) && !(tgt.type === 'bench' && tgt.pid === drag.pid)) el.classList.add('drop');
  }
  drag.target = tgt;
}, { passive: false });
document.addEventListener('pointerup', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.active) { drag = null; return; }
  const p = ghostPoint(e), src = { kind: drag.kind, pid: drag.pid, i: drag.i }, tgt = dropTarget(p.x, p.y);
  suppressClickUntil = Date.now() + 120;
  endDrag(); Promise.resolve(performDrop(src, tgt)).finally(render);
});
document.addEventListener('touchmove', e => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) endDrag(); });
document.addEventListener('contextmenu', e => { if (drag) e.preventDefault(); });

document.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'closeMenu' && t.classList.contains('scrim') && e.target.closest('[data-stop]')) return;
  const fn = H[t.dataset.act]; if (fn) { e.preventDefault(); fn(t, e); }
});
document.addEventListener('change', e => {
  const sel = e.target.closest && e.target.closest('select[name=pid]'); if (!sel) return;
  const box = sel.form.elements.n; box.hidden = sel.value !== '__new'; if (!box.hidden) box.focus();
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault(); FORMS[f.dataset.form](f);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { wakeAudio(); tick(); if (S.phase === 'game' && S.halfState === 'running') keepAwake(); }
});
window.addEventListener('pagehide', save);

/* ---------------- Boot ---------------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ }));
}
render();
setInterval(tick, 250);
window.__subBoard = { get state() { return S; }, tick };
})();
