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
  const touch = async (x, y) => { await page.touchscreen.tap(x, y); await wait(220); };
  await tap('[data-act=sample]'); // the roster is no longer built in: load the sample one
  await tap('[data-act=toLineup]'); await tap('[data-act=autofill]'); await tap('[data-act=kickoff]'); await wait(400);
  const b = await page.$eval('.bcard[data-act=bench]', e => e.dataset.pid);
  await tap(`.bcard[data-pid="${b}"]`); await tap('.tok[data-i="6"]'); await tap('[data-act=confirmSubs]'); await wait(300);
  const shown = () => page.$eval('#toast', e => e.classList.contains('show'));
  ok('Undo toast is up', await shown());
  const css = await page.evaluate(() => ({ t: getComputedStyle(document.querySelector('#toast')).pointerEvents, b: getComputedStyle(document.querySelector('#toast button')).pointerEvents }));
  ok('toast bar ignores pointer events, Undo button receives them', css.t === 'none' && css.b === 'auto', JSON.stringify(css));
  // cards that sit under the toast
  const hits = await page.evaluate(() => {
    const t = document.querySelector('#toast').getBoundingClientRect(), u = document.querySelector('#toast button').getBoundingClientRect(), out = [];
    document.querySelectorAll('.bcard').forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const l = Math.max(r.left, t.left), rt = Math.min(r.right, t.right), tp = Math.max(r.top, t.top), bt = Math.min(r.bottom, t.bottom);
      if (rt - l > 4 && bt - tp > 4) {
        // sample the overlap's left portion so we stay clear of the Undo button
        const x = l + 4, y = (tp + bt) / 2;
        const el0 = document.elementFromPoint(x, y); out.push({ dbg: el0 && (el0.tagName + '.' + el0.className + '#' + el0.id), i, cls: c.className, late: c.classList.contains('late'), x, y, top: (document.elementFromPoint(x, y) || {}).id || ((document.elementFromPoint(x, y).closest('.bcard') === c)), onUndo: x >= u.left && x <= u.right && y >= u.top && y <= u.bottom });
      }
    });
    const ur = u; const e = document.elementFromPoint(ur.left + ur.width / 2, ur.top + ur.height / 2);
    return { out, undoHit: !!(e && e.closest('#toast button')) };
  });
  console.log('cards under toast:', hits.out.map(h => `${h.late ? 'late' : 'bench'}#${h.i}`).join(', ') || 'none');
  const overlap = hits.out.length > 0; console.log(overlap ? 'overlap layout: tap-through is exercised' : 'N/A: toast does not overlap any bench card in this layout');
  ok('elementFromPoint under the toast hits the card, not the toast', hits.out.filter(h => !h.onUndo).every(h => h.top === true), JSON.stringify(hits.out.map(h => [h.top, h.dbg, h.x, h.y])));
  ok('Undo button still hit-tests as the button', hits.undoHit);
  // real tap on a bench card that sits under the toast selects it
  const tgt = hits.out.find(h => !h.late && !h.onUndo);
  if (tgt) {
    await touch(tgt.x, tgt.y);
    const sel = await page.$$eval('.bcard.sel', e => e.length);
    ok('tap through the toast selected the bench card', sel === 1);
    await tap('.bcard.sel');   // deselect
  } else console.log('N/A tap-through (no overlap); checking a bench card is tappable anyway');
  if (!tgt) { const pid = await page.$eval('.bcard[data-act=bench]', e => e.dataset.pid); await tap(`.bcard[data-pid="${pid}"]`); ok('bench card tappable while toast is up', (await page.$$eval('.bcard.sel', e => e.length)) === 1); await tap('.bcard.sel'); }
  // Undo still works on a fresh toast
  const lineupBefore = await page.evaluate(() => window.__subBoard.state.lineup.slice());
  await page.evaluate(() => window.__subBoard.state.lineup.length); // noop
  await tap('#toast button');
  const after = await page.evaluate(() => window.__subBoard.state.lineup.slice());
  ok('Undo button tap still undoes the sub', after.join() !== lineupBefore.join() && after[6] !== b);
  ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await browser.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
