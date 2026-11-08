const puppeteer = require('puppeteer-core');
const URL = process.argv[2] || 'http://localhost:8000/';
const W = +(process.argv[3] || 393), H = +(process.argv[4] || 852);
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  const tap = async sel => { const e = await page.$(sel); if (!e) throw new Error('missing ' + sel); await e.tap(); await wait(220); };
  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__subBoard.state)));
  const listOpen = async () => !!(await page.$('.fmlist'));
  await tap('[data-act=sample]'); // the roster is not built in: load the sample one
  await tap('[data-act=toLineup]'); await tap('[data-act=autofill]'); await tap('[data-act=kickoff]'); await wait(400);
  if (await page.$('.dialog')) { await tap('[data-act=dlgNo]'); await wait(300); } // a goalie prompt, if the sample lineup triggers one
  ok('half is live', (await state()).halfState === 'running');

  // queue a sub so we can check the switch keeps it
  const b = await page.$eval('.bcard[data-act=bench]', e => e.dataset.pid);
  await tap(`.bcard[data-pid="${b}"]`); await tap('.tok[data-i="5"]');
  ok('one sub queued', (await page.$$eval('.q', q => q.length)) === 1);

  await tap('[data-act=fmToggle]');
  ok('chip opens the formation list', await listOpen());
  const hit = await page.$eval('[data-act=pickFormation][data-f="4-4-2"]', e => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === e; });
  ok('list buttons sit on top (not under the scrim or players)', hit);

  const before = await state();
  await tap('[data-act=pickFormation][data-f="4-4-2"]');
  const s = await state();
  ok('formation switched mid-half', s.settings.formation === '4-4-2', s.settings.formation);
  ok('list closes after picking', !(await listOpen()));
  ok('goalie unchanged', s.lineup[0] === before.lineup[0]);
  ok('same players on the field', [...s.lineup].sort().join() === [...before.lineup].sort().join());
  ok('queued sub kept', (await page.$$eval('.q', q => q.length)) === 1);
  ok('toast names the formation and offers Undo', await page.$eval('#toast', t => t.classList.contains('show') && t.textContent.includes('4-4-2') && !!t.querySelector('button')));

  await tap('#toast button');
  const u = await state();
  ok('Undo restores formation and lineup', u.settings.formation === before.settings.formation && u.lineup.join() === before.lineup.join());

  // closing: the in-pitch scrim, then a tap on the dock
  await tap('[data-act=fmToggle]'); await tap('.fmscrim.in');
  ok('tap on the pitch closes the list', !(await listOpen()));
  await tap('[data-act=fmToggle]'); await tap('.dock [data-act=more]');
  ok('tap on the dock closes the list', !(await listOpen()));

  // halftime: the lineup screen before the 2nd-half kickoff, where the goalie spot starts empty
  await tap('[data-act=more]'); await tap('[data-fn=endHalf]'); await tap('[data-act=dlgYes]'); await wait(300);
  const ht = await state();
  ok('2nd half lineup screen, goalie spot empty', ht.half === 2 && ht.halfState === 'ready' && !ht.lineup[0]);
  await tap('[data-act=fmToggle]');
  ok('chip opens the list before the 2nd-half kickoff', await listOpen());
  await tap('[data-act=pickFormation][data-f="3-5-2"]');
  const h2 = await state();
  ok('formation switched at halftime', h2.settings.formation === '3-5-2', h2.settings.formation);
  ok('goalie spot stays empty (no outfield player dropped in goal)', !h2.lineup[0], h2.lineup[0]);
  ok('same players on the field at halftime', h2.lineup.filter(Boolean).sort().join() === ht.lineup.filter(Boolean).sort().join());
  ok('HUD still asks for a goalie', await page.$eval('.hud', e => /pick a goalie/i.test(e.textContent)));

  // pick a 2nd-half goalie from the bench, then switch again: the keeper stays in goal
  const gk = await page.$eval('.bcard[data-act=bench]', e => e.dataset.pid);
  await tap(`.bcard[data-pid="${gk}"]`); await tap('.tok[data-i="0"]');
  ok('goalie placed', (await state()).lineup[0] === gk);
  await tap('[data-act=fmToggle]'); await tap('[data-act=pickFormation][data-f="4-2-3-1"]');
  const h3 = await state();
  ok('switch with a goalie in place keeps the goalie', h3.settings.formation === '4-2-3-1' && h3.lineup[0] === gk);
  await tap('#toast button');
  const h4 = await state();
  ok('Undo at halftime restores formation and lineup', h4.settings.formation === '3-5-2' && h4.lineup[0] === gk);

  ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
