// Browser checks against a built app: the visible clock really counts down,
// no false interruption, one history record, tracker data left untouched.
// Usage: node scripts/e2e.mjs <baseUrl>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base = process.argv[2], port = 9400 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'e2e-'))}`, 'about:blank'], { stdio: 'ignore', detached: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
for (let i = 0; i < 40 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); ws = new WebSocket(l.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; }); } catch { ws = null; await sleep(250); } }
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
const click = async text => { const r = await ev(`(() => { const els = [...document.querySelectorAll('button,label')]; const lab = e => (e.getAttribute('aria-label') || e.textContent || '').trim(); const el = els.find(e => lab(e) === ${JSON.stringify(text)}) || els.find(e => lab(e).includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`); if (!r) fail(`could not click "${text}"`); await sleep(300); };
let failed = 0; const fail = m => { failed++; console.log('FAIL', m); }; const ok = (c, m) => (c ? console.log('ok  ', m) : fail(m));
const loaded = async () => { for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('#root')?.innerText?.trim()`)) return; await sleep(150); } fail('page did not load'); };
const timer = () => ev(`document.querySelector('[role=timer]')?.textContent`);
const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };

const TRACKER = {
  'workout-tracker-v6': JSON.stringify({ 'week-lifts-2026-11-09': { 0: 'Push' }, 'lift-2026-11-09-0-Incline Bench': { weight: 140, grid: [[true, true]], prescribedSets: 1, prescribedReps: 2 }, '2026-11-09-0-item-lift-Push': true }),
  'exercise-config-v1': JSON.stringify({ 'Incline Bench': { sets: 4, reps: 8, w: 140, inc: 5, bw: false, rest: 90 } }),
  'nutrition-v1': JSON.stringify({ sex: 'm', age: 30, ft: 5, inches: 10, weight: 180, goalWeight: 175, startWeight: 185, activity: 'moderate', goal: 'cut', weightKg: 81.6, heightCm: 177.8 }),
  'weight-log-v1': JSON.stringify([{ date: '2026-11-08', weight: 181.2 }]),
  'ui-prefs-v1': JSON.stringify({ hideNutrition: false }),
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: base }); await sleep(300); await loaded();
await ev(`(() => { const d = ${JSON.stringify(TRACKER)}; for (const k in d) localStorage.setItem(k, d[k]); })()`);
await send('Page.navigate', { url: base }); await sleep(300); await loaded(); await sleep(300);
ok(await ev(`document.body.innerText.replace(/\\s+/g, ' ').includes('MON 9 ◆')`), 'tracker shows the seeded week');

await click('Stretch'); await sleep(700);
await click('Details'); await click('Start'); await sleep(1200);
const a = secs(await timer()); await sleep(2500); const b = secs(await timer());
ok(b < a && a - b >= 2 && a - b <= 3, `get-ready clock counts down (${a} -> ${b})`);
await sleep(3000);                                   // now inside the first movement
const c = secs(await timer()); await sleep(3000); const d = secs(await timer());
ok(d < c && c - d >= 2 && c - d <= 4, `movement clock counts down (${c} -> ${d})`);
await sleep(9000);                                   // well past the old false-interruption point
ok(!(await ev(`document.body.innerText.includes('interrupted')`)), 'no false interruption after 17 s of running');
const e = secs(await timer());
ok(e < d - 7, `still counting (${d} -> ${e})`);
await click('Pause'); const p1 = await timer(); await sleep(1500); ok((await timer()) === p1, 'pause holds the clock');
await click('Resume'); await sleep(1300); ok(secs(await timer()) < secs(p1), 'resume continues');
await click('End session'); await click('End and save'); await sleep(300);
ok(await ev(`document.body.innerText.includes('Session saved')`), 'summary shows the session as saved');
await click('Done');
const hist = JSON.parse(await ev(`localStorage.getItem('mobility-v1')`)).history;
ok(hist.length === 1 && hist[0].activeSec >= 14 && hist[0].activeSec <= 19, `one history record with real active time (${hist[0]?.activeSec}s)`);
await send('Page.navigate', { url: base }); await sleep(300); await loaded(); await sleep(300);
ok(JSON.parse(await ev(`localStorage.getItem('mobility-v1')`)).history.length === 1, 'history survives a reload');
const after = JSON.parse(await ev(`JSON.stringify(Object.fromEntries(${JSON.stringify(Object.keys(TRACKER))}.map(k => [k, localStorage.getItem(k)])))`));
ok(JSON.stringify(after) === JSON.stringify(TRACKER), 'tracker storage is byte-for-byte unchanged');
ok(errors.length === 0, `no page errors ${errors.join(' | ')}`);
ws.close(); try { process.kill(-chrome.pid); } catch { chrome.kill(); }
process.exit(failed ? 1 : 0);
