// Local review tool: step through all 193 movements, mark each one and leave
// a note. Feedback is saved to review/feedback.json (and a readable
// review/feedback.md) every time something changes.
// Usage: npm run review   then open http://localhost:4400
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { EXERCISES, GROUP_LABELS } from '../src/mobility/data/catalog';
import { POSES } from '../src/mobility/data/poses';
import { Figure } from '../src/mobility/art/Figure';
import { doseLabel } from '../src/mobility/lib/timeline';

const PORT = Number(process.env.PORT ?? 4400);
const DIR = 'review', FILE = `${DIR}/feedback.json`, MD = `${DIR}/feedback.md`;
mkdirSync(DIR, { recursive: true });
const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {});

const items = EXERCISES.map(e => ({
  id: e.id, name: e.name, group: GROUP_LABELS[e.group], desc: e.desc, steps: e.steps, breath: e.breath ?? '',
  errors: e.errors, easier: e.easier, caution: e.caution ?? '', aliases: e.aliases, alt: e.alt,
  meta: `${e.category} · ${e.difficulty} · ${e.position} · ${doseLabel({ ex: e.id, dose: e.dose }, e)}`,
  svg: renderToStaticMarkup(<Figure pose={POSES[e.id]} seed={e.id} size="100%" />),
}));

const STATUS: Record<string, string> = { ok: 'Good', fix: 'Needs work', bad: 'Wrong' };
const TAGS = ['pose is wrong', 'hard to read', 'arrow wrong or missing', 'limbs tangled', 'text is wrong', 'name or alias'];

function writeMarkdown(fb: Record<string, any>) {
  const lines = ['# Movement review', ''];
  const done = items.filter(i => fb[i.id]?.status);
  lines.push(`${done.length} of ${items.length} reviewed: ${Object.keys(STATUS).map(s => `${done.filter(i => fb[i.id].status === s).length} ${STATUS[s].toLowerCase()}`).join(', ')}.`, '');
  for (const s of ['bad', 'fix', 'ok']) {
    const list = items.filter(i => fb[i.id]?.status === s && (s !== 'ok' || fb[i.id].note));
    if (!list.length) continue;
    lines.push(`## ${STATUS[s]}`, '');
    for (const i of list) {
      const f = fb[i.id];
      lines.push(`- **${i.name}** (\`${i.id}\`)${f.tags?.length ? ` [${f.tags.join('; ')}]` : ''}${f.note ? `: ${f.note.replace(/\s+/g, ' ')}` : ''}`);
    }
    lines.push('');
  }
  const noted = items.filter(i => !fb[i.id]?.status && fb[i.id]?.note);
  if (noted.length) { lines.push('## Notes without a mark', ''); for (const i of noted) lines.push(`- **${i.name}** (\`${i.id}\`): ${fb[i.id].note.replace(/\s+/g, ' ')}`); lines.push(''); }
  writeFileSync(MD, lines.join('\n'));
}

const page = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Movement review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#FAFAF8;color:#20211F;display:grid;grid-template-columns:270px 1fr;height:100vh}
aside{border-right:1px solid #E5E7E2;overflow-y:auto;background:#fff}aside h2{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#666A64;margin:14px 12px 4px}
aside button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:5px 12px;font:inherit;font-size:14px;cursor:pointer}
aside button.cur{background:#EEF2EC;font-weight:600}aside .dot{width:10px;height:10px;border-radius:50%;border:1.5px solid #B9BDB5;flex:none}
.dot.ok{background:#217E73;border-color:#217E73}.dot.fix{background:#D9AE48;border-color:#D9AE48}.dot.bad{background:#A83F25;border-color:#A83F25}.dot.note{box-shadow:0 0 0 2px #BBD5DF}
.filters{position:sticky;top:0;background:#fff;padding:10px 12px;border-bottom:1px solid #E5E7E2;z-index:1}.filters select{width:100%;padding:6px;font:inherit}
main{overflow-y:auto;padding:20px 28px 40px}.top{display:flex;align-items:center;gap:12px;margin-bottom:8px}.top h1{margin:0;font-size:26px;flex:1}
.count{color:#666A64;font-variant-numeric:tabular-nums}.nav button,.marks button,.tags label{font:inherit;border:1px solid #D5D8D1;background:#fff;border-radius:10px;padding:8px 14px;cursor:pointer}
.cols{display:grid;grid-template-columns:minmax(300px,440px) 1fr;gap:28px;align-items:start}.art{position:sticky;top:0}.art .big{width:100%}.sizes{display:flex;gap:14px;align-items:end;margin-top:10px;color:#666A64;font-size:13px}
.sizes div{text-align:center}.s96{width:96px}.s52{width:52px}
.meta{color:#666A64;margin:0 0 10px}h3{margin:14px 0 4px;font-size:15px}ol,ul{margin:0;padding-left:22px}p{margin:0 0 8px}
.panel{background:#fff;border:1px solid #E5E7E2;border-radius:14px;padding:14px;margin-top:16px}.marks{display:flex;gap:8px;flex-wrap:wrap}
.marks button.on[data-s=ok]{background:#217E73;color:#fff;border-color:#217E73}.marks button.on[data-s=fix]{background:#D9AE48;border-color:#D9AE48}.marks button.on[data-s=bad]{background:#A83F25;color:#fff;border-color:#A83F25}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.tags label{padding:5px 10px;font-size:14px}.tags input{margin-right:5px}
textarea{width:100%;min-height:90px;font:inherit;padding:10px;border:1px solid #D5D8D1;border-radius:10px}kbd{background:#EEF2EC;border-radius:4px;padding:1px 5px;font-size:13px}
.help{color:#666A64;font-size:13px;margin-top:8px}.saved{color:#217E73;font-size:13px;margin-left:8px}
</style></head><body>
<aside><div class="filters"><select id="filter"><option value="all">All movements</option><option value="todo">Not reviewed yet</option><option value="fix">Needs work</option><option value="bad">Wrong</option><option value="ok">Good</option><option value="note">Has a note</option></select><div class="count" id="summary" style="margin-top:6px;font-size:13px"></div></div><div id="list"></div></aside>
<main>
<div class="top"><h1 id="name"></h1><span class="count" id="pos"></span><span class="nav"><button id="prev">← Prev</button> <button id="next">Next →</button></span></div>
<p class="meta" id="meta"></p>
<div class="cols"><div class="art"><div class="big" id="big"></div><div class="sizes"><div><div class="s96" id="mid"></div>routine card</div><div><div class="s52" id="small"></div>list</div></div></div>
<div><p id="desc"></p><h3>How to do it</h3><ol id="steps"></ol><div id="extra"></div>
<div class="panel"><div class="marks" id="marks"></div><div class="tags" id="tags"></div>
<textarea id="note" placeholder="What is wrong, or what would make it clearer?"></textarea>
<div class="help"><kbd>←</kbd> <kbd>→</kbd> move · <kbd>1</kbd> good · <kbd>2</kbd> needs work · <kbd>3</kbd> wrong · <kbd>N</kbd> jump to the note · in the note: <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves and goes to the next one, <kbd>Esc</kbd> leaves the box<span class="saved" id="saved"></span></div></div></div></div>
</main>
<script>
const ITEMS=${JSON.stringify(items).replace(/</g, '\\u003c')};const STATUS=${JSON.stringify(STATUS)};const TAGS=${JSON.stringify(TAGS)};
let fb=${JSON.stringify(load()).replace(/</g, '\\u003c')};let idx=Number(sessionStorage.getItem('idx')||0);let filter='all';
const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const matches=i=>{const f=fb[i.id]||{};return filter==='all'||(filter==='todo'&&!f.status)||(filter==='note'&&f.note)||f.status===filter};
let timer;function save(){clearTimeout(timer);timer=setTimeout(async()=>{const r=await fetch('/save',{method:'POST',body:JSON.stringify(fb)});$('saved').textContent=r.ok?'Saved':'NOT SAVED';setTimeout(()=>$('saved').textContent='',1200)},250)}
function cur(){return ITEMS[idx]}
function setStatus(s){const f=fb[cur().id]=fb[cur().id]||{};f.status=f.status===s?'':s;f.updatedAt=new Date().toISOString();save();render()}
function renderList(){let html='',g='';ITEMS.forEach((i,n)=>{if(!matches(i))return;if(i.group!==g){g=i.group;html+='<h2>'+esc(g)+'</h2>'}const f=fb[i.id]||{};html+='<button data-n="'+n+'" class="'+(n===idx?'cur':'')+'"><span class="dot '+(f.status||'')+(f.note?' note':'')+'"></span>'+esc(i.name)+'</button>'});$('list').innerHTML=html||'<p style="padding:12px;color:#666A64">Nothing matches this filter.</p>';
const done=ITEMS.filter(i=>(fb[i.id]||{}).status);$('summary').textContent=done.length+' of '+ITEMS.length+' reviewed · '+ITEMS.filter(i=>['fix','bad'].includes((fb[i.id]||{}).status)).length+' flagged';
const c=$('list').querySelector('.cur');if(c)c.scrollIntoView({block:'nearest'})}
function render(){const i=cur(),f=fb[i.id]||{};sessionStorage.setItem('idx',idx);$('name').textContent=i.name;$('pos').textContent=(idx+1)+' / '+ITEMS.length;$('meta').textContent=i.group+' · '+i.meta+(i.aliases.length?' · also: '+i.aliases.join(', '):'');
['big','mid','small'].forEach(k=>$(k).innerHTML=i.svg);$('desc').textContent=i.desc;$('steps').innerHTML=i.steps.map(s=>'<li>'+esc(s)+'</li>').join('');
$('extra').innerHTML=(i.breath?'<h3>Breathing</h3><p>'+esc(i.breath)+'</p>':'')+'<h3>Common errors</h3><ul>'+i.errors.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul><h3>Make it easier</h3><p>'+esc(i.easier)+'</p>'+(i.caution?'<h3>Caution</h3><p>'+esc(i.caution)+'</p>':'')+'<h3>Picture description</h3><p>'+esc(i.alt)+'</p>';
$('marks').innerHTML=Object.keys(STATUS).map((s,n)=>'<button data-s="'+s+'" class="'+(f.status===s?'on':'')+'">'+(n+1)+' · '+STATUS[s]+'</button>').join('');
$('tags').innerHTML=TAGS.map(t=>'<label><input type="checkbox" value="'+esc(t)+'"'+((f.tags||[]).includes(t)?' checked':'')+'>'+esc(t)+'</label>').join('');
if(document.activeElement!==$('note'))$('note').value=f.note||'';renderList()}
function go(d){const order=ITEMS.map((_,n)=>n).filter(n=>matches(ITEMS[n])||n===idx);const at=order.indexOf(idx);const to=order[at+d];if(to===undefined)return;idx=to;$('note').blur();$('note').value=(fb[cur().id]||{}).note||'';render();document.querySelector('main').scrollTop=0}
$('prev').onclick=()=>go(-1);$('next').onclick=()=>go(1);
$('list').onclick=e=>{const b=e.target.closest('button');if(b){idx=Number(b.dataset.n);$('note').blur();$('note').value=(fb[cur().id]||{}).note||'';render()}};
$('marks').onclick=e=>{const b=e.target.closest('button');if(b)setStatus(b.dataset.s)};
$('tags').onchange=()=>{const f=fb[cur().id]=fb[cur().id]||{};f.tags=[...$('tags').querySelectorAll('input:checked')].map(x=>x.value);f.updatedAt=new Date().toISOString();save();renderList()};
$('note').oninput=()=>{const f=fb[cur().id]=fb[cur().id]||{};f.note=$('note').value;f.updatedAt=new Date().toISOString();save();renderList()};
$('filter').onchange=e=>{filter=e.target.value;renderList()};
document.addEventListener('keydown',e=>{const inNote=document.activeElement===$('note');
if(inNote){if(e.key==='Escape')$('note').blur();if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();go(1)}return}
if(e.target.tagName==='SELECT')return;
if(e.key==='ArrowRight'||e.key==='j'){e.preventDefault();go(1)}else if(e.key==='ArrowLeft'||e.key==='k'){e.preventDefault();go(-1)}
else if(e.key==='1')setStatus('ok');else if(e.key==='2')setStatus('fix');else if(e.key==='3')setStatus('bad');else if(e.key==='n'||e.key==='N'){e.preventDefault();$('note').focus()}});
render();
</script></body></html>`;

createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      try {
        const fb = JSON.parse(body);
        writeFileSync(FILE, JSON.stringify(fb, null, 2) + '\n');
        writeMarkdown(fb);
        res.writeHead(200).end('ok');
      } catch { res.writeHead(400).end('bad'); }
    });
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(page());
}).listen(PORT, '127.0.0.1', () => console.log(`Movement review: http://localhost:${PORT}  (feedback -> ${FILE})`));
