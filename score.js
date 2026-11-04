// Pure score logic (no DOM drawing): parse one part, expand repeats, build a timeline.
const STEP = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
const r4 = x => Math.round(x * 1e4) / 1e4;

function parseScore(part) {
  const tr = part.ownerDocument.querySelector('transpose');
  const num = (el, t) => { const x = el && el.querySelector(t); return x ? +x.textContent : 0; };
  const sh = tr ? num(tr, 'chromatic') + 12 * num(tr, 'octave-change') : 0; // written -> concert
  let div = 256, beats = 4, base = 0, endsCur = null;
  const ms = [], open = {};
  for (const m of part.children) {
    if (m.tagName !== 'measure') continue;
    const o = {base, len: 0, notes: [], stops: [], fer: [], fwd: false, bwd: 0, ends: null, endStop: false};
    let pos = 0, last = 0, mx = 0, stopEnd = false;
    for (const c of m.children) {
      const t = c.tagName;
      if (t === 'attributes') {
        const d = c.querySelector('divisions'); if (d) div = +d.textContent;
        const b = c.querySelector('time beats'); if (b) beats = +b.textContent;
      } else if (t === 'backup') pos -= num(c, 'duration');
      else if (t === 'forward') pos += num(c, 'duration');
      else if (t === 'barline') {
        const r = c.querySelector('repeat'), e = c.querySelector('ending');
        if (r) { if (r.getAttribute('direction') === 'forward') o.fwd = true; else o.bwd = +(r.getAttribute('times') || 2); }
        if (e) {
          if (e.getAttribute('type') === 'start') endsCur = (e.getAttribute('number').match(/\d+/g) || []).map(Number);
          else stopEnd = true;
        }
      } else if (t === 'note' && !c.querySelector('grace')) {
        const dur = num(c, 'duration'), chord = !!c.querySelector('chord'), st = chord ? last : pos;
        if (!chord) { last = pos; pos += dur; mx = Math.max(mx, pos); }
        const q = r4(st / div); o.stops.push(q);
        if (!chord && c.querySelector('fermata')) o.fer.push({q, d: dur / div});
        const p = c.querySelector('pitch');
        if (p) {
          const midi = (num(p, 'octave') + 1) * 12 + STEP[p.querySelector('step').textContent] + num(p, 'alter') + sh;
          const ts = c.querySelector('tie[type="stop"]'), tb = c.querySelector('tie[type="start"]');
          if (ts && open[midi]) { open[midi].d += dur / div; if (!tb) delete open[midi]; }
          else { const n = {q, d: dur / div, midi}; o.notes.push(n); if (tb) open[midi] = n; }
        }
      }
    }
    if (endsCur) { o.ends = endsCur; if (stopEnd) { o.endStop = true; endsCur = null; } }
    o.stops = [...new Set(o.stops)].sort((a, b) => a - b);
    o.len = mx / div; base += o.len; ms.push(o);
  }
  // global cursor index for every stop (matches the single-part notation cursor, no repeats)
  const keys = [...new Set(ms.flatMap(o => o.stops.map(q => r4(o.base + q))))].sort((a, b) => a - b);
  const gm = new Map(keys.map((k, i) => [k, i]));
  ms.forEach(o => { o.g = o.stops.map(q => gm.get(r4(o.base + q))); });
  return {ms, beats, total: base};
}

// Measure play order with repeats and 1st/2nd endings. No D.S./D.C./coda.
function expandOrder(ms) {
  const out = [], n = ms.length;
  let i = 0, start = 0, pass = 1, guard = 0;
  while (i < n && guard++ < 5000) {
    const m = ms[i];
    if (m.fwd) start = i;
    if (m.ends && !m.ends.includes(pass)) { i++; continue; }
    out.push(i);
    if (m.bwd) {
      if (pass < m.bwd) { pass++; i = start; continue; }
      pass = 1; start = i + 1;
    } else if (m.endStop) { pass = 1; start = i + 1; }
    i++;
  }
  return out;
}

// Times are in quarter notes. A fermata holds for double its written length.
function buildTimeline(ev, repeat) {
  const order = repeat ? expandOrder(ev.ms) : ev.ms.map((_, i) => i);
  let off = 0; const notes = [], steps = [];
  for (const i of order) {
    const m = ev.ms[i];
    const T = q => off + q + m.fer.reduce((s, f) => s + (f.q + f.d <= q + 1e-6 ? f.d : 0), 0);
    for (const n of m.notes) {
      const f = m.fer.find(f => Math.abs(f.q - n.q) < 1e-6);
      notes.push({t: T(n.q), d: n.d + (f ? f.d : 0), midi: n.midi});
    }
    m.stops.forEach((q, k) => steps.push({t: T(q), g: m.g[k]}));
    off += m.len + m.fer.reduce((s, f) => s + f.d, 0);
  }
  return {notes, steps, total: off};
}
