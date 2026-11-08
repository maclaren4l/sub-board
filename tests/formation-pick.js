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

  ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
