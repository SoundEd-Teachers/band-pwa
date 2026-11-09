// Drone tuner tab. Adapted from SoundEd Drone Tuner V2; wrapped so its names cannot clash with the rest of the app.
(function () {
// --- INSTRUMENTS CONFIGURATION (Score Order) ---
const INSTRUMENTS = {
    flute:    { name: "Flute",                 clef: "treble", shift: 0  },
    oboe:     { name: "Oboe",                  clef: "treble", shift: 0  },
    clarinet: { name: "Bb Clarinet",           clef: "treble", shift: 2  },
    bassClarinet: { name: "Bass Clarinet", clef: "treble", shift: 14 },
    altoSax:  { name: "Alto Saxophone",        clef: "treble", shift: 9  },
    tenorSax: { name: "Tenor Saxophone",       clef: "treble", shift: 14 },
    bariSax:  { name: "Baritone Saxophone",    clef: "treble", shift: 21 },
    horn:     { name: "French Horn",           clef: "treble", shift: 7  },
    trumpet:  { name: "Trumpet",               clef: "treble", shift: 2  },
    bassoon:  { name: "Bassoon",               clef: "bass",   shift: 0  },
    trombone: { name: "Trombone / Euphonium",  clef: "bass",   shift: 0  },
    tuba:     { name: "Tuba",                  clef: "bass",   shift: 0  }
};

const displayNotes = ["C","C♯/D♭","D","D♯/E♭","E","F","F♯/G♭","G","G♯/A♭","A","A♯/B♭","B"];

let audioCtx, analyser, droneOsc, droneGain, micStream;
let tunerInstKey = 'flute', wakeLock = null;
let isRunning = false, isMicMuted = false;
let smoothedCents = 0, strobeAngle = 0, showStrobe = true, animationId;
let noiseGate = 0.015, droneVolume = 0.2;
let droneEnabled = true, earsOnly = false;
let showNoteNames = true, showNotation = true;

// Stability Logic
let lastStableMidi = -1;
let framesStable = 0;
const STABILITY_THRESHOLD = 5;

let streakStartTime = null, streakActive = false;
const STREAK_THRESHOLD_TIME = 1000, STREAK_TOTAL_TIME = 6000;
let difficulty = { smoothing: 0.96, greenZone: 10, yellowZone: 20, strobeSpeed: 0.005, streakRange: 5 };

const canvas = document.getElementById('tunerCanvas'), ctx = canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 3);   // crisp dial on phone screens
canvas.width = canvas.height = 300 * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
const toggleBtn = document.getElementById('toggleSystemBtn');
const micBtn = document.getElementById('micToggleBtn');
const streakContainer = document.getElementById('streak-container'), streakFill = document.getElementById('streak-fill');
const noteNameEl = document.getElementById('note-name');
const notationCard = document.getElementById('notation-card');
const notationContainer = document.getElementById('notationContainer');

let lastRenderedWrittenMidi = null;
let lastRenderedClef = null;

// --- VEXFLOW NOTATION RENDERER ---
function midiToVexFlowSpecs(writtenMidi) {
    const pitchClass = ((writtenMidi % 12) + 12) % 12;
    const octave = Math.floor(writtenMidi / 12) - 1;

    // Side-by-side enharmonics: Flat first, Sharp second
    switch(pitchClass) {
        case 0:  return [{ key: `c/${octave}`, acc: null }];
        case 1:  return [{ key: `d/${octave}`, acc: "b" }, { key: `c/${octave}`, acc: "#" }];
        case 2:  return [{ key: `d/${octave}`, acc: null }];
        case 3:  return [{ key: `e/${octave}`, acc: "b" }, { key: `d/${octave}`, acc: "#" }];
        case 4:  return [{ key: `e/${octave}`, acc: null }];
        case 5:  return [{ key: `f/${octave}`, acc: null }];
        case 6:  return [{ key: `g/${octave}`, acc: "b" }, { key: `f/${octave}`, acc: "#" }];
        case 7:  return [{ key: `g/${octave}`, acc: null }];
        case 8:  return [{ key: `a/${octave}`, acc: "b" }, { key: `g/${octave}`, acc: "#" }];
        case 9:  return [{ key: `a/${octave}`, acc: null }];
        case 10: return [{ key: `b/${octave}`, acc: "b" }, { key: `a/${octave}`, acc: "#" }];
        case 11: return [{ key: `b/${octave}`, acc: null }];
        default: return [];
    }
}

function renderNotation(writtenMidi, clef) {
    if (!showNotation || earsOnly) {
        notationContainer.innerHTML = "";
        lastRenderedWrittenMidi = null;
        return;
    }
    if (writtenMidi === null) {
        notationContainer.innerHTML = "";
        lastRenderedWrittenMidi = null;
        return;
    }
    if (writtenMidi === lastRenderedWrittenMidi && clef === lastRenderedClef) {
        return;
    }

    lastRenderedWrittenMidi = writtenMidi;
    lastRenderedClef = clef;
    notationContainer.innerHTML = "";

    if (typeof Vex === "undefined" || !Vex.Flow) {
        notationContainer.innerHTML = "<span style='color:#666;font-size:12px;'>Notation Offline</span>";
        return;
    }

    try {
        const VF = Vex.Flow;
        const width = 220;
        const height = 132;
        const renderer = new VF.Renderer(notationContainer, VF.Renderer.Backends.SVG);
        renderer.resize(width, height);
        const vfContext = renderer.getContext();

        // Stave coordinates within white card
        const stave = new VF.Stave(5, 12, width - 12);
        stave.addClef(clef);
        stave.setContext(vfContext).draw();

        const noteSpecs = midiToVexFlowSpecs(writtenMidi);
        if (noteSpecs.length === 0) return;

        let staveNotes = [];
        if (noteSpecs.length === 1) {
            // Natural / single note
            const sn = new VF.StaveNote({
                clef: clef,
                keys: [noteSpecs[0].key],
                duration: "w"
            });
            if (noteSpecs[0].acc) sn.addModifier(new VF.Accidental(noteSpecs[0].acc), 0);
            staveNotes.push(sn);
        } else {
            // Side-by-side enharmonic pair: Flat first, Sharp second
            for (let i = 0; i < noteSpecs.length; i++) {
                const sn = new VF.StaveNote({
                    clef: clef,
                    keys: [noteSpecs[i].key],
                    duration: "h"
                });
                if (noteSpecs[i].acc) sn.addModifier(new VF.Accidental(noteSpecs[i].acc), 0);
                staveNotes.push(sn);
            }
        }

        const voice = new VF.Voice({ num_beats: noteSpecs.length === 1 ? 4 : 4, beat_value: 4 });
        voice.setMode(VF.Voice.Mode.SOFT);
        voice.addTickables(staveNotes);

        const formatter = new VF.Formatter().joinVoices([voice]).format([voice], width - 68);
        voice.draw(vfContext, stave);
    } catch (err) {
        console.error("VexFlow render error:", err);
    }
}

// --- CONTROLS ---

document.getElementById('gateSlider').oninput = function() { 
    noiseGate = parseFloat(this.value);
    document.getElementById('gateVal').innerText = Math.round(noiseGate*1000);
}

document.getElementById('volSlider').oninput = function() { 
    droneVolume = parseFloat(this.value); 
    document.getElementById('volVal').innerText = Math.round(droneVolume*100) + "%";
    if (droneEnabled && droneGain) droneGain.gain.setTargetAtTime(droneVolume, audioCtx.currentTime, 0.1);
}

function setDifficulty(level, btn) {
    document.querySelectorAll('#view-tuner .diff-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    if (level === 'student') difficulty = { smoothing: 0.96, greenZone: 10, yellowZone: 20, strobeSpeed: 0.005, streakRange: 5 };
    else if (level === 'advanced') difficulty = { smoothing: 0.90, greenZone: 6, yellowZone: 12, strobeSpeed: 0.015, streakRange: 3 };
    else difficulty = { smoothing: 0.80, greenZone: 3, yellowZone: 7, strobeSpeed: 0.04, streakRange: 1 };
    resetStreak();
}

// --- SYSTEM START/STOP ---

async function startSystem() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    ensureVex();
    try {
        micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser(); 
        analyser.fftSize = 4096; 
        source.connect(analyser);

        droneOsc = audioCtx.createOscillator(); 
        droneGain = audioCtx.createGain();
        droneGain.gain.setValueAtTime(0, audioCtx.currentTime);
        droneOsc.connect(droneGain); 
        droneGain.connect(audioCtx.destination);
        droneOsc.start(); 

        isRunning = true;
        isMicMuted = false;
        requestWake();
        updateMicUI();
        render();
        
        toggleBtn.innerText = "STOP SYSTEM"; 
        toggleBtn.className = "btn-stop";
        micBtn.disabled = false;
    } catch (e) { alert("The tuner needs microphone access. Allow it when asked, or check this site's microphone setting in your browser."); }
}

function stopSystem() {
    isRunning = false;
    if (droneGain) droneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    if (micStream) micStream.getTracks().forEach(track => track.stop());
    try { droneOsc.stop(); } catch (e) {}
    releaseWake();
    cancelAnimationFrame(animationId);
    resetStreak();
    resetVisuals();
    
    toggleBtn.innerText = "START SYSTEM"; 
    toggleBtn.className = "btn-start";
    micBtn.disabled = true;
    micBtn.innerHTML = '<span id="micIcon">🎤</span> <span id="micText">Mic: OFF</span>';
    micBtn.className = "";
}

toggleBtn.onclick = () => isRunning ? stopSystem() : startSystem();

micBtn.onclick = function() {
    if (!isRunning) return;
    isMicMuted = !isMicMuted;
    updateMicUI();
}

function updateMicUI() {
    const icon = document.getElementById('micIcon');
    const text = document.getElementById('micText');
    if (isMicMuted) {
        micBtn.classList.add('muted');
        icon.innerText = "🔇";
        text.innerText = "MUTED";
        if (droneGain) droneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    } else {
        micBtn.classList.remove('muted');
        icon.innerText = "🎤";
        text.innerText = "LIVE";
    }
}

// --- AUDIO LOGIC ---

function autoCorrelate(buf, sampleRate) {
    let rms = 0; for (let i=0; i<buf.length; i++) rms += buf[i]*buf[i];
    rms = Math.sqrt(rms/buf.length);
    if (rms < noiseGate || isMicMuted) return -1;
    
    let r1=0, r2=buf.length-1, thres=0.2;
    for (let i=0; i<buf.length/2; i++) if (Math.abs(buf[i])<thres) { r1=i; break; }
    for (let i=1; i<buf.length/2; i++) if (Math.abs(buf[buf.length-i])<thres) { r2=buf.length-i; break; }
    buf = buf.slice(r1,r2);
    let c = new Float32Array(buf.length).fill(0);
    for (let i=0; i<buf.length; i++) for (let j=0; j<buf.length-i; j++) c[i] = c[i] + buf[j]*buf[j+i];
    let d=0; while (c[d]>c[d+1]) d++;
    let maxval=-1, maxpos=-1;
    for (let i=d; i<buf.length; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    return sampleRate/maxpos;
}

function render() {
    if (!isRunning) return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const freq = autoCorrelate(buffer, audioCtx.sampleRate);
    
    ctx.clearRect(0, 0, 300, 300);

    const instKey = tunerInstKey;
    const inst = INSTRUMENTS[instKey] || INSTRUMENTS.clarinet;

    if (freq !== -1 && freq > 50 && freq < 3000) {
        const midi = 12 * (Math.log2(freq / 440)) + 69;
        const roundedMidi = Math.round(midi);
        const rawCents = (midi - roundedMidi) * 100;
        
        if (roundedMidi === lastStableMidi) {
            framesStable++;
        } else {
            framesStable = 0;
            lastStableMidi = roundedMidi;
        }

        // Transposed Written MIDI for Display & Notation
        const writtenMidi = roundedMidi + inst.shift;
        const writtenNoteIndex = ((writtenMidi % 12) + 12) % 12;

        smoothedCents = (smoothedCents * difficulty.smoothing) + (rawCents * (1 - difficulty.smoothing));
        noteNameEl.innerText = displayNotes[writtenNoteIndex];
        document.getElementById('cents-display').innerText = (smoothedCents > 0 ? "+" : "") + Math.round(smoothedCents) + " cents";

        // Real-time notation render
        notationCard.classList.add('active');
        renderNotation(writtenMidi, inst.clef);
        
        // Anti-R2D2 drone update (matches concert sounding pitch)
        if (framesStable > STABILITY_THRESHOLD) {
            droneOsc.type = document.getElementById('waveType').value;
            droneOsc.frequency.setTargetAtTime(440 * Math.pow(2, (roundedMidi - 69) / 12), audioCtx.currentTime, 0.05);
            if (droneEnabled && !isMicMuted) {
                droneGain.gain.setTargetAtTime(droneVolume, audioCtx.currentTime, 0.1);
            }
        }

        updateStreak(smoothedCents);
        drawVisuals(smoothedCents);
    } else {
        if (droneGain) droneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
        resetStreak();
        smoothedCents *= 0.9;
        if (Math.abs(smoothedCents) < 1) {
            noteNameEl.innerText = "--";
            document.getElementById('cents-display').innerText = "0 cents";
            notationCard.classList.remove('active');
            renderNotation(null, inst.clef);
        }
    }
    updateConfetti();
    animationId = requestAnimationFrame(render);
}

// --- VISUALS & STREAK ---

function updateStreak(cents) {
    if (Math.abs(cents) <= difficulty.streakRange) {
        if (!streakStartTime) streakStartTime = Date.now();
        let elapsed = Date.now() - streakStartTime;
        if (elapsed >= STREAK_THRESHOLD_TIME) {
            streakContainer.classList.add('visible');
            let progress = ((elapsed - STREAK_THRESHOLD_TIME) / (STREAK_TOTAL_TIME - STREAK_THRESHOLD_TIME)) * 100;
            streakFill.style.width = Math.min(progress, 100) + "%";
            if (progress >= 100) { streakActive = true; addFlowConfetti(); }
        }
    } else {
        resetStreak();
    }
}

function resetStreak() {
    streakStartTime = null;
    streakActive = false;
    streakContainer.classList.remove('visible');
    streakFill.style.width = "0%";
    particles = []; 
}

function resetVisuals() {
    ctx.clearRect(0, 0, 300, 300);
    noteNameEl.innerText = "--";
    noteNameEl.style.color = "#333";
    document.getElementById('cents-display').innerText = "0 cents";
    notationCard.classList.remove('active');
    renderNotation(null, "treble");
}

function drawVisuals(cents) {
    const cx = 150, cy = 150, absCents = Math.abs(cents);
    let color = "#ff4444"; 
    if (absCents <= difficulty.greenZone) color = "#00A600";
    else if (absCents <= difficulty.yellowZone) color = "#ffcc00";

    noteNameEl.style.color = earsOnly ? "#0053A6" : ((absCents < difficulty.yellowZone + 10) ? color : "#333");

    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
    const rad = (cents * 1.5 - 90) * (Math.PI / 180);
    ctx.moveTo(cx, cy); ctx.lineTo(cx + 120 * Math.cos(rad), cy + 120 * Math.sin(rad)); ctx.stroke();

    if (showStrobe) {
        let strobeMovement = absCents < 0.5 ? 0 : cents;
        strobeAngle += (strobeMovement * difficulty.strobeSpeed); 
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(strobeAngle);
        ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.setLineDash([2, 10]); 
        ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.stroke();
        if (absCents > 1 || color === "#00A600") {
            ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.setLineDash([8, 25]); 
            ctx.beginPath(); ctx.arc(0, 0, 140, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }
}

// --- CONFETTI & UTILS ---
const confettiCanvas = document.getElementById('confetti-canvas');
const confCtx = confettiCanvas.getContext('2d');
let particles = [];

function addFlowConfetti() {
    confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight;
    for (let i = 0; i < 2; i++) {
        particles.push({
            x: Math.random() * window.innerWidth, y: -10,
            dirX: (Math.random() - 0.5) * 4, dirY: Math.random() * 3 + 2,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`, size: Math.random() * 6 + 3,
            rot: Math.random() * Math.PI, rotV: Math.random() * 0.1
        });
    }
}
function updateConfetti() {
    confCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.dirX; p.y += p.dirY; p.rot += p.rotV;
        confCtx.save(); confCtx.translate(p.x, p.y); confCtx.rotate(p.rot);
        confCtx.fillStyle = p.color; confCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        confCtx.restore();
        if (p.y > window.innerHeight) particles.splice(i, 1);
    }
}

function playTestTone() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 440; gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

// --- TOGGLES & LEARNING MODES ---
document.getElementById('toggleNoteName').onclick = function() {
    showNoteNames = !showNoteNames;
    this.classList.toggle('active', showNoteNames);
    noteNameEl.classList.toggle('hidden', !showNoteNames);
};

document.getElementById('toggleNotation').onclick = function() {
    showNotation = !showNotation;
    this.classList.toggle('active', showNotation);
    notationCard.classList.toggle('hidden', !showNotation);
    if (!showNotation) {
        notationContainer.innerHTML = "";
        lastRenderedWrittenMidi = null;
    }
};

document.getElementById('earsToggle').onclick = function() {
    earsOnly = !earsOnly;
    document.getElementById('ears-mask').classList.toggle('active', earsOnly);
    this.innerText = earsOnly ? "Ears Only: ON" : "Ears Only Mode";
    this.classList.toggle('active', earsOnly);
    document.getElementById('cents-display').classList.toggle('hidden', earsOnly);
    notationCard.classList.toggle('hidden', earsOnly || !showNotation);
    noteNameEl.classList.toggle('hidden', earsOnly || !showNoteNames);
    if (earsOnly) {
        notationContainer.innerHTML = "";
        lastRenderedWrittenMidi = null;
    }
};

document.getElementById('strobeToggle').onclick = function() {
    showStrobe = !showStrobe;
    this.classList.toggle('active', showStrobe);
};

document.getElementById('droneToggle').onclick = function() {
    droneEnabled = !droneEnabled;
    this.classList.toggle('active', droneEnabled);
    if (!droneEnabled && droneGain) droneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
};

function setInstrument(key, label) {
    tunerInstKey = INSTRUMENTS[key] ? key : 'flute';
    document.getElementById('tn-inst').innerText = label;
    lastRenderedWrittenMidi = null;
    const inst = INSTRUMENTS[tunerInstKey];
    if (isRunning && lastStableMidi !== -1) {
        const writtenMidi = lastStableMidi + inst.shift;
        const writtenNoteIndex = ((writtenMidi % 12) + 12) % 12;
        noteNameEl.innerText = displayNotes[writtenNoteIndex];
        renderNotation(writtenMidi, inst.clef);
    }
}

// --- BAND APP INTEGRATION ---
document.querySelectorAll('#view-tuner .diff-btn').forEach(b => b.addEventListener('click', () => setDifficulty(b.dataset.level, b)));
document.getElementById('testAudioBtn').addEventListener('click', playTestTone);

function ensureVex() {   // notation library loads the first time the tuner starts
    if (window.Vex || document.getElementById('vexflow-js')) return;
    const el = document.createElement('script'); el.id = 'vexflow-js'; el.src = 'assets/vendor/vexflow.js';
    document.head.appendChild(el);
}
async function requestWake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }

// Never leave the mic open in the background
document.addEventListener('visibilitychange', () => { if (document.hidden && isRunning) stopSystem(); });
window.addEventListener('pagehide', () => { if (isRunning) stopSystem(); });
window.Tuner = { setInstrument, stop: () => { if (isRunning) stopSystem(); } };

})();
