// Confirms the built app loads with the network switched off after one visit.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const base = process.argv[2], port = 9400 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'off-'))}`, 'about:blank'], { stdio: 'ignore', detached: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 40 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); ws = new WebSocket(l.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise((a, b) => { ws.onopen = a; ws.onerror = b; }); } catch { ws = null; await sleep(250); } }
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result ?? m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Network.enable');
await send('Page.navigate', { url: base }); await sleep(1500);
console.log('service worker:', await ev(`navigator.serviceWorker.ready.then(r => r.active ? r.active.state : 'none')`));
await sleep(1500);
console.log('cached files:', await ev(`caches.keys().then(async ks => (await (await caches.open(ks[0])).keys()).length)`));
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await send('Page.navigate', { url: base }); await sleep(1500);
console.log('offline tracker loads:', await ev(`document.body.innerText.includes('TRAINING')`));
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Stretch')).click()`); await sleep(1200);
console.log('offline stretching loads:', await ev(`document.body.innerText.includes('Browse by area')`));
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Library').click()`); await sleep(500);
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Exercises').click()`); await sleep(500);
console.log('offline illustrations:', await ev(`document.querySelectorAll('svg[role=img]').length`));
ws.close(); try { process.kill(-chrome.pid); } catch { chrome.kill(); }
