// Drives headless Chrome over the DevTools protocol to screenshot the app.
// Usage: node scripts/shots.mjs <baseUrl> <outDir>
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, out] = process.argv.slice(2);
const port = 9333;
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shots-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find(t => t.type === 'page');
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
      };
      return;
    } catch { await sleep(250); }
  }
  throw new Error('no chrome');
}
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const shot = async name => { await sleep(350); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name + '.png'), Buffer.from(r.data, 'base64')); console.log('shot', name); };
const click = text => ev(`(() => { const els = [...document.querySelectorAll('button,a,summary,label')]; const el = els.find(e => (e.getAttribute('aria-label') || e.textContent || '').trim() === ${JSON.stringify(text)}) || els.find(e => (e.getAttribute('aria-label') || e.textContent || '').trim().startsWith(${JSON.stringify(text)})); if (!el) return 'MISSING ${text}'; el.click(); return 'ok'; })()`).then(r => { if (r !== 'ok') console.log(r); return sleep(250); });
const go = async () => { await send('Page.navigate', { url: base }); await sleep(900); };

await connect();
await send('Runtime.enable'); await send('Page.enable');
await size(390, 844);
await go();
await shot('01-tracker');
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Stretch')).click()`); await sleep(900);
await shot('02-today');
await click('Details'); await shot('03-routine');
await click('Back');
await click('Library'); await shot('04-library');
await click('Exercises'); await shot('05-exercises');
await click('Filters'); await shot('06-filters'); await click('Show results');
await click('Create'); await shot('07-create');
await click('Describe what you want');
await ev(`(() => { const i = document.querySelector('#req'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'standing warm-up before walking; avoid kneeling'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await click('Plan'); await shot('08-planner');
await click('Start'); await sleep(1500); console.log('vis', await ev('document.visibilityState'), await ev(`(() => { const s = JSON.parse(localStorage.getItem('mobility-session-v1')); return JSON.stringify([s.idx, s.elapsedMs, s.running, s.interrupted]); })()`)); await shot('09-player');
await sleep(4500); await shot('10-player-work');
await click('Instructions'); await shot('11-info'); await click('Close');
await click('Next movement'); await click('Next movement'); await sleep(13000); await shot('11b-player-late');
await click('End session'); await click('End and save'); await shot('12-summary');
await click('Done');
await click('Progress'); await shot('13-progress');
await click('History'); await shot('14-history');
await click('Settings'); await shot('15-settings');
await click('Create'); await click('Build it yourself'); await click('Add Cat Cow'); await click('Add Lunge'); await click('Add Butterfly'); await shot('16-picker');
await click('Done ('); await shot('17-builder');
await ev(`localStorage.setItem('mobility-v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('mobility-v1')), settings: { ...JSON.parse(localStorage.getItem('mobility-v1')).settings, appearance: 'dark', textSize: 'larger' } }))`);
await go(); await shot('18-dark-large');
await click('Library'); await click('Exercises'); await shot('19-dark-exercises');
await size(1280, 800); await go(); await shot('20-desktop');
await click('Library'); await shot('21-desktop-library');
await size(320, 640); await go(); await shot('22-narrow');
console.log('keys:', await ev('JSON.stringify(Object.keys(localStorage))'));
console.log('history:', await ev(`JSON.stringify(JSON.parse(localStorage.getItem('mobility-v1')).history.map(h => [h.routineName, h.activeSec, h.completed, h.skipped, h.total]))`));
console.log('errors:', errors.length ? errors : 'none');
ws.close(); chrome.kill();
