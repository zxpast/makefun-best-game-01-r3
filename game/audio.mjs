// Synthesized sound for ROADWARD. No audio files: every effect is a small
// WebAudio patch built at runtime. The game runs fine with sound off or
// with no AudioContext at all (Node, muted tab).

let ctx = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;

export function setMuted(m) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) {
    return null;
  }
}

function tone(freq, dur, type, vol, slideTo) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol, low) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = low || 1200;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

const SOUNDS = {
  shoot() { tone(720 + Math.random() * 160, 0.07, 'square', 0.05, 420); },
  kill() { tone(320, 0.12, 'triangle', 0.08, 90); },
  coin() { tone(880, 0.07, 'sine', 0.06); setTimeout(() => tone(1320, 0.09, 'sine', 0.06), 60); },
  build() { tone(180, 0.14, 'sine', 0.12, 320); noise(0.08, 0.05, 600); },
  leak() { tone(140, 0.3, 'sawtooth', 0.12, 70); },
  horn() { tone(196, 0.5, 'sawtooth', 0.09, 294); setTimeout(() => tone(294, 0.5, 'sawtooth', 0.07, 392), 180); },
  'boss-phase'() { noise(0.5, 0.14, 500); tone(90, 0.5, 'sawtooth', 0.12, 55); },
  'boss-down'() { noise(0.4, 0.16, 900); tone(523, 0.15, 'triangle', 0.1); setTimeout(() => tone(784, 0.2, 'triangle', 0.1), 120); },
  'night-clear'() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 110)); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 140)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sawtooth', 0.07), i * 180)); },
  'tower-hit'() { tone(220, 0.06, 'square', 0.04, 160); },
  'tower-down'() { noise(0.3, 0.12, 700); tone(160, 0.3, 'sawtooth', 0.08, 60); },
};

// Play one named effect. Unknown names are ignored.
export function play(name) {
  const fn = SOUNDS[name];
  if (fn) fn();
}

// A quiet night-time pad: a low drone that steps through a minor scale.
// Started on the first user gesture, stopped on mute.
const SCALE = [110, 130.8, 146.8, 164.8, 196, 220];
export function startMusic() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (muted) return;
    const f = SCALE[musicStep % SCALE.length];
    musicStep++;
    tone(f, 1.6, 'sine', 0.025);
    tone(f * 1.5, 1.6, 'sine', 0.012);
  }, 900);
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
