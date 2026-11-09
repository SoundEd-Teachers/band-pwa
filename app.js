// --- helpers ---
const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
};

// --- instruments: file part names are matched to these families ---
const FAM = [['Flute',/^flute/i],['Oboe',/^oboe/i],['Bassoon',/^bassoon/i],['Clarinet',/^clarinet/i],
  ['Bass Clarinet',/^bass clarinet/i],['Alto Sax',/^alto sax/i],['Tenor Sax',/^tenor sax/i],['Bari Sax',/^bari(tone)? sax/i],
  ['Trumpet',/^trumpet/i],['Horn',/^(french |f )?horn/i],['Trombone',/^trombone/i],['Euphonium',/^(euph|baritone horn)/i],['Tuba',/^tuba/i]];
const LINKS = {Bassoon:['Trombone','Euphonium'], Trombone:['Euphonium','Bassoon'], Euphonium:['Trombone','Bassoon'],
  'Alto Sax':['Bari Sax'], 'Bari Sax':['Alto Sax']};
const PERC = /marimba|xylophone|vibraphone|bells|glock|timpani|percussion|drum|snare|cymbal/i;
const famOf = n => { const f = FAM.find(x => x[1].test(n)); return f ? f[0] : null; };
const norm = n => n.toLowerCase().replace(/ in (b♭|bb|b flat|e♭|eb|e flat|f)\b/, '').trim();

// --- state ---
let inst = store.get('band.inst'), view = 'scales', level = 'all', readyOnly = false;
let cur = null, parts = [], tok = 0, bpm = 80;
const domCache = {};

// --- list view ---
function buildFilters() {
  const opts = [['all','All'],['1','Level 1'],['2','Level 2'],['3','Level 3'],['4','Level 4'],['5','Level 5'],['ready','✓ Ready']];
  $('filters').innerHTML = opts.map(([v, t]) => `<button class="filter-btn" data-v="${v}">${t}</button>`).join('');
  syncFilters();
}
function syncFilters() {
  document.querySelectorAll('#filters .filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.v === 'ready' ? readyOnly : (b.dataset.v === level)));
}
function renderGrid() {
  $('hint').textContent = view === 'scales' ? 'Scale names are in concert pitch.' : '';
  const items = CATALOG.filter(it => it.group === view && (level === 'all' || it.level === +level) && (!readyOnly || it.file));
  $('grid').innerHTML = items.map(it => {
    const c = CATS[it.cat];
    return `<div class="rudiment-card${it.file ? '' : ' soon'}" data-id="${it.id}" style="border-left-color:${c.color}">
      <h3>${it.name}</h3><span class="badge">${c.name}</span>
      <small>Level ${it.level} · ${it.slot}${it.file ? '' : ' · not here yet'}</small></div>`;
  }).join('') || '<p class="hint">Nothing here yet.</p>';
}

// --- instrument picker ---
function updateInstBtn() { $('inst-btn').textContent = inst ? '🎺 ' + inst + ' ▾' : 'Pick instrument'; }
function openInst() {
  $('inst-grid').innerHTML = FAM.map(([n]) => `<button data-n="${n}" class="${n === inst ? 'on' : ''}">${n}</button>`).join('');
  $('inst-modal').classList.remove('hidden');
}

// --- parts ---
function listParts(dom) {
  const raw = [...dom.querySelectorAll('score-part')].map(sp => {
    const name = sp.querySelector('part-name').textContent.trim();
    return {id: sp.getAttribute('id'), name, fam: famOf(name)};
  }).filter(p => !PERC.test(p.name));
  const seen = {}, count = {};
  raw.forEach(p => count[p.name] = (count[p.name] || 0) + 1);
  raw.forEach(p => { seen[p.name] = (seen[p.name] || 0) + 1; p.label = count[p.name] > 1 ? `${p.name} (${seen[p.name]})` : p.name; });
  return raw;
}
function pickPart() {
  const pref = store.get('band.part.' + inst);
  let p = pref && parts.find(x => norm(x.name) === pref);
  if (p) return p;
  for (const f of [inst, ...(LINKS[inst] || [])]) { p = parts.find(x => x.fam === f); if (p) return p; }
  return null;
}
function noteFor(p) {
  $('part-note').textContent = !p ? `No ${inst} part in this one yet. Pick a part from the list.`
    : (p.fam && p.fam !== inst ? `${inst} reads the ${p.name} part.` : '');
}
async function showPart(id, my) {
  const p = parts.find(x => x.id === id); if (!p) return;
  await Player.show($('sheet'), domCache[cur.file], id);
  if (my !== tok) return;
}

// --- practice modal ---
async function openItem(it) {
  if (!inst) return openInst();
  const my = ++tok, M = $('practice-modal'); cur = it; Player.stop();
  M.classList.remove('hidden', 'oops');
  $('modal-title').textContent = it.name;
  const b = $('modal-category'); b.textContent = CATS[it.cat].name; b.style.background = CATS[it.cat].color;
  $('part-note').textContent = ''; $('part-sel').innerHTML = ''; Player.clear($('sheet'));
  setBpm(it.bpm || 80);
  if (!it.file) { M.classList.add('oops'); return; }
  let dom = domCache[it.file];
  if (!dom) {
    try {
      const r = await fetch('assets/musicxml/' + it.file.split('/').map(encodeURIComponent).join('/')); if (!r.ok) throw 0;
      dom = new DOMParser().parseFromString(await r.text(), 'application/xml');
      if (dom.querySelector('parsererror')) throw 0;
      domCache[it.file] = dom;
    } catch (e) { if (my === tok) M.classList.add('oops'); return; }
  }
  if (my !== tok) return;
  parts = listParts(dom);
  const sel = $('part-sel'), pick = pickPart();
  if (!pick) sel.add(new Option('Choose a part…', ''));
  parts.forEach(p => sel.add(new Option(p.label, p.id)));
  if (pick) sel.value = pick.id;
  noteFor(pick);
  if (pick) await showPart(pick.id, my);
}
function closeItem() { tok++; Player.stop(); $('practice-modal').classList.add('hidden'); }

// --- transport ---
function setBpm(v) {
  bpm = Math.max(40, Math.min(200, Math.round(v)));
  $('bpm-slider').value = bpm; $('bpm-display').textContent = bpm;
}
const opts = () => ({bpm, notes: $('o-notes').checked, click: $('o-click').checked, countIn: $('o-count').checked, repeat: $('o-rep').checked});
async function togglePlay() {
  if (Player.isPlaying()) return Player.stop();
  await Player.play(opts());
  if (Player.isPlaying()) setPlayLabel(true);
}
const restartIfPlaying = () => { if (Player.isPlaying()) togglePlay().then(togglePlay); };

// --- tuner tab: notes are shown for the instrument picked in the app ---
const TUNER_KEY = {'Flute':'flute','Oboe':'oboe','Bassoon':'bassoon','Clarinet':'clarinet','Bass Clarinet':'bassClarinet',
  'Alto Sax':'altoSax','Tenor Sax':'tenorSax','Bari Sax':'bariSax','Trumpet':'trumpet','Horn':'horn',
  'Trombone':'trombone','Euphonium':'trombone','Tuba':'tuba'};
function syncTuner() { Tuner.setInstrument(TUNER_KEY[inst] || 'flute', inst || 'Concert pitch'); }

// --- wiring ---
const setPlayLabel = on => { $('play').textContent = on ? '■ Stop' : '▶ Play'; $('fab-play').textContent = on ? '■' : '▶'; };
Player.onStop(() => setPlayLabel(false));
$('filters').onclick = e => {
  const v = e.target.dataset.v; if (!v) return;
  if (v === 'ready') readyOnly = !readyOnly; else level = v;
  syncFilters(); renderGrid();
};
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
  view = b.dataset.view;
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('active', x === b));
  const tuner = view === 'tuner';
  $('view-list').classList.toggle('active', !tuner);
  $('view-tuner').classList.toggle('active', tuner);
  document.body.classList.toggle('tuner-on', tuner);
  if (tuner) syncTuner(); else { Tuner.stop(); renderGrid(); }
});
$('grid').onclick = e => { const c = e.target.closest('.rudiment-card'); if (c) openItem(CATALOG.find(x => x.id === c.dataset.id)); };
$('inst-btn').onclick = openInst;
$('tn-inst-btn').onclick = openInst;
$('inst-close').onclick = () => $('inst-modal').classList.add('hidden');
$('inst-grid').onclick = e => {
  const n = e.target.dataset.n; if (!n) return;
  inst = n; store.set('band.inst', n); updateInstBtn(); syncTuner(); $('inst-modal').classList.add('hidden');
};
$('close-modal-btn').onclick = closeItem;
$('part-sel').onchange = async e => {
  const my = ++tok, p = parts.find(x => x.id === e.target.value);
  Player.stop(); noteFor(p);
  if (!p) return;
  if (p.fam && [inst, ...(LINKS[inst] || [])].includes(p.fam)) store.set('band.part.' + inst, norm(p.name));
  await showPart(p.id, my);
};
$('play').onclick = togglePlay;
$('fab-play').onclick = togglePlay;
$('fab-back').onclick = closeItem;
$('bpm-down').onclick = () => { setBpm(bpm - 4); restartIfPlaying(); };
$('bpm-up').onclick = () => { setBpm(bpm + 4); restartIfPlaying(); };
$('bpm-slider').oninput = e => setBpm(+e.target.value);
$('bpm-slider').onchange = restartIfPlaying;

buildFilters(); renderGrid(); updateInstBtn(); syncTuner();
if (!inst) openInst();
