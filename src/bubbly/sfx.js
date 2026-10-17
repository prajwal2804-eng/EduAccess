export const read = (k, d) => {
  try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; }
};
export const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

let ctx = null;
let bus = null;
let noiseBuf = null;
let enabled = read("bb-sfx", true);
let master = read("bb-vol-v2", 1);

// optional real recordings (see "Optional" in the instructions). If missing, synth sounds are used.
const samples = { hover: null, pop: null };
let loading = false;
async function loadSamples(c) {
  if (loading) return;
  loading = true;
  const base = import.meta.env.BASE_URL || "/";
  for (const key of ["hover", "pop"]) {
    for (const ext of ["mp3", "wav", "ogg"]) {
      try {
        const r = await fetch(`${base}sounds/bubble-${key}.${ext}`);
        if (!r.ok) continue;
        samples[key] = await c.decodeAudioData(await r.arrayBuffer());
        break;
      } catch { /* not a valid audio file: try the next one */ }
    }
  }
}

const audio = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const boost = ctx.createGain();
    boost.gain.value = 3;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 10;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    boost.connect(limiter);
    limiter.connect(ctx.destination);
    bus = boost;
    loadSamples(ctx);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

function tone({ freq, to, dur = 0.12, type = "sine", gain = 0.2, delay = 0, attack = 0.012 }) {
  if (!enabled || master <= 0) return;
  const c = audio();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * master), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

// filtered noise burst (random start point, so no two pops are identical)
function noise({ dur = 0.06, freq = 3000, q = 1, gain = 0.3, delay = 0 }) {
  if (!enabled || master <= 0) return;
  const c = audio();
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.3), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, gain * master), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t0, Math.random() * 0.2);
  s.stop(t0 + dur + 0.02);
}

function playSample(buf, { rate = 1, gain = 0.8 } = {}) {
  if (!enabled || master <= 0) return;
  const c = audio();
  const s = c.createBufferSource();
  s.buffer = buf;
  s.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = gain * master;
  s.connect(g).connect(bus);
  s.start();
}

const arp = (notes, step, opts) =>
  notes.forEach((f, i) => tone({ freq: f, delay: i * step, ...opts }));

// water-bubble "bloop": a pure sine whose pitch glides up as it rings out
const bloop = ({ f = 900, rise = 1.6, dur = 0.09, gain = 0.3, delay = 0 }) =>
  tone({ freq: f, to: f * rise, dur, type: "sine", gain, delay, attack: 0.004 });

export const sfx = {
  pop: () => tone({ freq: 520, to: 900, dur: 0.1, type: "triangle", gain: 0.3 }),
  tick: () => tone({ freq: 1000, dur: 0.035, type: "triangle", gain: 0.08 }),
  flip: () => tone({ freq: 280, to: 720, dur: 0.18, type: "triangle", gain: 0.28 }),
  good: () => arp([523, 659, 784, 1047], 0.07, { dur: 0.22, type: "triangle", gain: 0.28 }),
  oops: () => tone({ freq: 340, to: 230, dur: 0.22, type: "triangle", gain: 0.25 }),
  fanfare: () => arp([523, 659, 784, 1047, 1319, 1568], 0.09, { dur: 0.32, type: "triangle", gain: 0.28 }),

  // ----- bubbles -----
  bubbleHover: () => {
    if (samples.hover) return playSample(samples.hover, { rate: 0.85 + Math.random() * 0.45, gain: 0.6 });
    // random bubble size: small = high pitch, big = lower pitch
    bloop({ f: 650 + Math.random() * 750, rise: 1.5 + Math.random() * 0.4, dur: 0.09, gain: 0.22 });
  },
  bubbleSqueak: () => {
    // faint wet squish as your finger touches the film (real bubbles don't squeak)
    noise({ dur: 0.05, freq: 1400, q: 0.6, gain: 0.07 });
  },
  bubblePop: () => {
    if (samples.pop) return playSample(samples.pop, { rate: 0.92 + Math.random() * 0.2, gain: 0.9 });
    noise({ dur: 0.02, freq: 6500, q: 0.5, gain: 0.7 });               // the film snapping: sharp tick
    noise({ dur: 0.08, freq: 3600, q: 0.7, gain: 0.22, delay: 0.004 }); // airy "pff"
    tone({ freq: 240, to: 120, dur: 0.05, gain: 0.2, attack: 0.003 });  // soft air thump
    bloop({ f: 2300 + Math.random() * 700, rise: 1.4, dur: 0.04, gain: 0.1, delay: 0.025 }); // tiny droplets
    bloop({ f: 2900 + Math.random() * 700, rise: 1.4, dur: 0.035, gain: 0.08, delay: 0.05 });
  },
};

export const isSfxOn = () => enabled;
export const setSfxOn = (v) => { enabled = v; write("bb-sfx", v); };
export const getVol = () => master;
export const setVol = (v) => { master = v; write("bb-vol-v2", v); };