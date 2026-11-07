const puppeteer = require('puppeteer-core');
const URL = process.argv[2] || 'http://localhost:8000/';
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); if (!c) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await (await browser.createBrowserContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: +(process.argv[3]||393), height: +(process.argv[4]||852), deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { const r = Date.now.bind(Date); window.__off = 0; Date.now = () => r() + window.__off; });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  const tap = async sel => { const e = await page.$(sel); if (!e) throw new Error('missing ' + sel); await e.tap(); await wait(220); };
  const shown = () => page.evaluate(() => document.querySelector('#toast').classList.contains('show'));
  const phase = () => page.evaluate(() => window.__subBoard.state.phase);
  const queueSub = async spot => { const b = await page.$eval('.bcard[data-act=bench]', e => e.dataset.pid); await tap(`.bcard[data-pid="${b}"]`); await tap(`.tok[data-i="${spot}"]`); await tap('[data-act=confirmSubs]'); };

  await tap('[data-act=sample]'); // the roster is no longer built in: load the sample one
  await tap('[data-act=toLineup]'); await tap('[data-act=autofill]'); await tap('[data-act=kickoff]'); await wait(400);

  // --- 2. time-up fires while the ••• menu is open -> no toast over the menu
  await tap('[data-act=more]');
  ok('menu open', !!(await page.$('[data-fn=endHalf]')));
  await page.evaluate(() => { window.__off += 40 * 60000; }); await wait(900);
  ok('"Time is up" did NOT show a toast over the open menu', !(await shown()));
  ok('menu still open', !!(await page.$('.more')));
  await tap('.morescrim');
  ok('dock now offers the End half action', /End half/.test(await page.$eval('.dock .dmain', e => e.textContent)));
  // a later toast still works once the menu is closed
  await queueSub(5);
  ok('toasts work again after the menu closes', await shown());

  // --- 5. the timer path goes through hideToast() and removes it after 9 s
  await wait(9400);
  ok('Undo toast auto-hides after ~9 s', !(await shown()));

  // --- 7. no stale position on the toast's first frame (sampled every frame while it is up)
  await page.evaluate(() => {
    window.__worst = 0; window.__frames = 0;
    const t = document.querySelector('#toast');
    (function loop() {
      const dw = document.querySelector('.dockwrap');
      if (t.classList.contains('show') && dw) {
        const d = dw.getBoundingClientRect();
        const want = d.top - 8, have = parseFloat(t.style.getPropertyValue('--tt'));
        window.__worst = Math.max(window.__worst, Math.abs(want - have)); window.__frames++;
      }
      requestAnimationFrame(loop);
    })();
  });
  await queueSub(6); await wait(600);
  const f = await page.evaluate(() => ({ worst: window.__worst, frames: window.__frames }));
  ok('toast position matched the dock on every painted frame', f.frames > 0 && f.worst < 1, `${f.frames} frames, worst offset ${f.worst.toFixed(1)}px`);

  const g = await page.evaluate(() => { const t = document.querySelector('#toast').getBoundingClientRect(), d = document.querySelector('.dockwrap').getBoundingClientRect(), dk = document.querySelector('.dock').getBoundingClientRect(); return { gap: d.top - t.bottom, cx: (t.left + t.right) / 2 - (d.left + d.right) / 2, inView: t.top >= 0 && t.bottom <= innerHeight, over: [...document.querySelectorAll('.dock button')].some(b => { const r = b.getBoundingClientRect(); return !(r.right <= t.left || r.left >= t.right || r.bottom <= t.top || r.top >= t.bottom); }) }; });
  ok('rendered toast bottom is 8px above the dock', Math.abs(g.gap - 8) < 1, 'gap=' + g.gap.toFixed(2));
  ok('toast centred over the dock, on screen, over no dock button', Math.abs(g.cx) < 1 && g.inView && !g.over, `dx=${g.cx.toFixed(2)} inView=${g.inView} overButton=${g.over}`);

  // --- 6. New game clears the toast (toast up -> settings sheet -> End game and start over)
  await queueSub(7).catch(() => {});   // may be unavailable if no bench players remain; toast from the sub above is still up otherwise
  ok('a toast is up before starting a new game', await shown());
  await tap('[data-act=menu]');
  await tap('.sheet [data-act=newGame]');
  await tap('[data-act=dlgYes]'); await wait(300);
  ok('new game reached the setup screen', (await phase()) === 'setup');
  ok('toast cleared by New game', !(await shown()));

  // --- 6b. Reset to full team clears a toast (exercise the handler while a toast is showing)
  await page.evaluate(() => { const t = document.querySelector('#toast'); t.innerHTML = '<span>stale</span><button data-act="undo">Undo</button>'; t.classList.add('show'); });
  ok('stale toast showing on setup', await shown());
  await tap('[data-act=restoreTeam]');
  ok('toast cleared by Reset to full team', !(await shown()));

  ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
