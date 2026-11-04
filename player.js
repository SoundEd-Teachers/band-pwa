// Notation (OpenSheetMusicDisplay) + audio playback for one part at a time.
const Player = (() => {
  let osmd = null, ev = null, ac = null, bus = null, nodes = [], raf = 0, playing = false, cur = 0, lastW = 0, rt = 0, stopCb = () => {};
  const zoom = () => innerWidth < 600 ? .7 : 1;
  function draw() { osmd.zoom = zoom(); osmd.render(); osmd.cursor.show(); cur = 0; lastW = innerWidth; }

  async function show(el, dom, id) {
    stop(); ev = null;
    const d = dom.cloneNode(true);
    d.querySelectorAll('score-part,part').forEach(s => s.getAttribute('id') !== id && s.remove());
    d.querySelectorAll('part-group,credit').forEach(s => s.remove());
    const xml = '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(d.documentElement);
    if (!osmd) osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(el, {autoResize: false, drawingParameters: 'compact', drawPartNames: false, drawPartAbbreviations: false, followCursor: true, backend: 'svg'});
    await osmd.load(xml); draw();
    ev = parseScore(d.querySelector('part'));
  }
  function clear(el) { stop(); ev = null; osmd = null; el.innerHTML = ''; }

  function seek(g) {
    if (!osmd) return;
    if (g < cur) { osmd.cursor.reset(); cur = 0; }
    while (cur < g) { osmd.cursor.next(); cur++; }
  }
  function tone(t, d, midi) {
    const o = ac.createOscillator(), g = ac.createGain(), e = Math.max(.05, d * .97), r = Math.min(.05, e / 3);
    o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .015);
    g.gain.setValueAtTime(.2, t + e - r); g.gain.linearRampToValueAtTime(0, t + e);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + e + .02); nodes.push(o);
  }
  function click(t, acc) {
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = acc ? 1500 : 1000;
    g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + .07); nodes.push(o);
  }

  async function play(o) {
    if (!ev || !osmd) return;
    stop();
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    await ac.resume();
    const tl = buildTimeline(ev, o.repeat), spq = 60 / o.bpm, ci = o.countIn ? ev.beats : 0;
    const startAt = ac.currentTime + .2 + ci * spq, end = startAt + tl.total * spq;
    bus = ac.createGain(); bus.connect(ac.destination);
    if (o.click) for (let b = -ci; b < Math.ceil(tl.total); b++) click(startAt + b * spq, b % ev.beats === 0);
    if (o.notes) tl.notes.forEach(n => tone(startAt + n.t * spq, n.d * spq, n.midi));
    seek(0); playing = true; let si = 0;
    (function loop() {
      if (!playing) return;
      const now = ac.currentTime;
      while (si < tl.steps.length && now >= startAt + tl.steps[si].t * spq) { seek(tl.steps[si].g); si++; }
      if (now > end + .3) return stop();
      raf = requestAnimationFrame(loop);
    })();
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf);
    nodes.forEach(o => { try { o.stop(); } catch (e) {} }); nodes = [];
    if (bus) { bus.disconnect(); bus = null; }
    if (osmd && ev) { seek(0); if (innerWidth !== lastW) draw(); }
    stopCb();
  }
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (osmd && ev && !playing && innerWidth !== lastW) draw(); }, 250);
  });
  return {show, clear, play, stop, isPlaying: () => playing, onStop: f => { stopCb = f; }};
})();
