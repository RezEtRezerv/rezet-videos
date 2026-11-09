// Fon musiqisi generatoru: hər video üçün öz musiqisini yaradır (müəllif hüququ problemi yoxdur).
// 8 janr var, hər birinin öz alətləri, ritmi, tonallığı və melodiyası olur. Claude hər gün janrı seçir.
// Səhnə dəyişən anlarda (marks) zərb və "riser" effekti çalınır ki, musiqi görüntü ilə uyğun gəlsin.
// İstifadə: import { makeMusic, GENRES, pickBpm } from './music.mjs';
//           makeMusic({ seed, genre, bpm, bars, marks, file })
import fs from 'node:fs';

const SR = 44100, TAU = Math.PI * 2;
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

// Eyni seed = eyni musiqi
function rng(seed) {
  let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function noiseGen(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 2147483648 - 1; }; }
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t * d);

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], penta: [0, 2, 4, 7, 9], minpenta: [0, 3, 5, 7, 10], harmonic: [0, 1, 4, 5, 7, 8, 10] };

// Hər janrın temp aralığı, əsas notu, səs düzümü və akkord ardıcıllıqları (MIDI notları, sonra tonallığa sürüşür)
export const GENRES = {
  lofi: { label: 'lo-fi hip hop', bpm: [70, 78], swing: 0.6, root: 60, scale: 'major', keys: [-2, 0, 2, 3, 5], progs: [
    [[62, 65, 69, 72, 76], [55, 59, 62, 65, 69], [60, 64, 67, 71, 74], [57, 60, 64, 67, 71]],
    [[60, 64, 67, 71, 74], [57, 60, 64, 67, 72], [62, 65, 69, 72, 76], [55, 59, 64, 65, 69]]] },
  trap: { label: 'trap', bpm: [128, 136], swing: 0.5, root: 57, scale: 'minpenta', keys: [-3, -2, 0, 2], progs: [
    [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
    [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 55, 59]]] },
  house: { label: 'deep house', bpm: [114, 118], swing: 0.5, root: 57, scale: 'minor', keys: [-2, 0, 1, 3], progs: [
    [[57, 60, 64, 67], [50, 53, 57, 60], [53, 57, 60, 64], [52, 55, 59, 62]],
    [[50, 53, 57, 60], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]]] },
  afro: { label: 'afrobeats', bpm: [96, 104], swing: 0.55, root: 60, scale: 'penta', keys: [-3, 0, 2, 5], progs: [
    [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    [[48, 52, 55, 59], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]] },
  synthwave: { label: 'synthwave', bpm: [88, 96], swing: 0.5, root: 57, scale: 'minor', keys: [-2, 0, 2, 4], progs: [
    [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    [[50, 53, 57], [53, 57, 60], [48, 52, 55], [52, 55, 59]]] },
  acoustic: { label: 'acoustic pop', bpm: [86, 98], swing: 0.5, root: 60, scale: 'penta', keys: [-3, 0, 2, 5], progs: [
    [[48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],
    [[53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67], [55, 59, 62, 67]]] },
  mugham: { label: 'Azerbaijani tar + daf fusion', bpm: [80, 88], swing: 0.5, root: 55, scale: 'harmonic', keys: [-2, 0, 2], progs: [
    [[55, 58, 62], [53, 57, 60], [51, 55, 58], [50, 54, 57]],
    [[55, 58, 62], [51, 55, 58], [53, 57, 60], [50, 54, 57]]] },
  funk: { label: 'funk', bpm: [94, 102], swing: 0.56, root: 52, scale: 'dorian', keys: [-2, 0, 2, 3], progs: [
    [[52, 55, 59, 62, 66], [57, 61, 64, 67, 71], [52, 55, 59, 62, 66], [57, 61, 64, 67, 71]],
    [[50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [52, 55, 59, 62, 66], [57, 61, 64, 67, 71]]] }
};
export const pickBpm = (genre, seed) => { const g = GENRES[genre] || GENRES.lofi; const r = rng(seed + ':bpm'); return Math.round(g.bpm[0] + r() * (g.bpm[1] - g.bpm[0])); };

// Sadə Schroeder reverb
function reverb(inp, size) {
  const out = new Float32Array(inp.length);
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(x => Math.round(x * size));
  for (const D of combs) {
    const buf = new Float32Array(D); let k = 0, lp = 0;
    for (let i = 0; i < inp.length; i++) { const y = buf[k]; lp = y * 0.72 + lp * 0.28; buf[k] = inp[i] + lp * 0.8; k = (k + 1) % D; out[i] += y / combs.length; }
  }
  for (const D of [225, 556].map(x => Math.round(x * size))) {
    const buf = new Float32Array(D); let k = 0;
    for (let i = 0; i < out.length; i++) { const b = buf[k], y = -out[i] + b; buf[k] = out[i] + b * 0.5; out[i] = y; k = (k + 1) % D; }
  }
  return out;
}

export function makeMusic({ seed = 'rezet', genre = 'lofi', bpm, bars = 12, marks = [], file, tail = 2 }) {
  const G = GENRES[genre] ? genre : 'lofi', g = GENRES[G];
  const r = rng(seed + ':' + G), nz = noiseGen(Math.floor(r() * 1e9));
  bpm = bpm || pickBpm(G, seed);
  const beat = 60 / bpm, bar = beat * 4, st = beat / 4;
  const N = Math.ceil((bars * bar + tail) * SR);
  const L = new Float32Array(N), R = new Float32Array(N), DL = new Float32Array(N), DR = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);
  const key = g.keys[Math.floor(r() * g.keys.length)];
  const prog = g.progs[Math.floor(r() * g.progs.length)].map(c => c.map(n => n + key));
  const scale = SCALES[g.scale], tonic = g.root + key;
  const deg = d => tonic + scale[((d % scale.length) + scale.length) % scale.length] + 12 * Math.floor(d / scale.length);
  const intro = bars >= 6 ? 1 : 0, last = bars - 1;
  const full = b => b >= intro && b < last;
  const human = G === 'lofi' ? 0.012 : G === 'funk' || G === 'afro' ? 0.006 : 0;
  const at = (b, s) => b * bar + s * st + (s % 2 === 1 ? (g.swing - 0.5) * 2 * st : 0) + (human ? (r() - 0.5) * human : 0);
  const kicks = [];

  // Bir səsi buferə yazır. fn(t) ardıcıl çağırılır (filtr vəziyyəti saxlanır)
  const play = (t0, dur, fn, { gain = 1, pan = 0, send = 0, duck = false, rel = 0.03 } = {}) => {
    const s0 = Math.round(t0 * SR), n = Math.round(dur * SR), relN = Math.max(1, Math.round(rel * SR));
    const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
    const oL = duck ? DL : L, oR = duck ? DR : R;
    for (let j = 0; j < n; j++) {
      const i = s0 + j; if (i >= N) break;
      let v = fn(j / SR); if (i < 0) continue;
      if (j > n - relN) v *= (n - j) / relN;
      oL[i] += v * gl; oR[i] += v * gr;
      if (send) { VL[i] += v * gl * send; VR[i] += v * gr * send; }
    }
  };

  /* ---------- alətlər ---------- */
  const I = {
    sine: (f, d = 3) => t => Math.sin(TAU * f * t) * env(t, 0.005, d),
    epiano: (f, d = 1.4, idx = 1.6) => t => (Math.sin(TAU * f * t + idx * Math.exp(-t * 4) * Math.sin(TAU * f * t)) + 0.12 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6)) * env(t, 0.004, d),
    bell: (f, d = 2.2) => t => Math.sin(TAU * f * t + 2.4 * Math.exp(-t * 2.5) * Math.sin(TAU * f * 3.5 * t)) * env(t, 0.002, d),
    marimba: f => t => Math.sin(TAU * f * t + 1.1 * Math.exp(-t * 14) * Math.sin(TAU * f * 4 * t)) * env(t, 0.002, 6.5),
    saw: (f, { cut = 2600, d = 2, det = 0.007, fenv = 4, H } = {}) => {
      const h = H || Math.max(2, Math.min(14, Math.floor(7000 / f))); let a1 = 0, a2 = 0;
      return t => {
        let s = 0;
        for (const dd of [-det, det]) { const ff = f * (1 + dd); for (let k = 1; k <= h; k++) s += Math.sin(TAU * ff * k * t + k * dd * 40) / k; }
        const fc = cut * (0.3 + 0.7 * Math.exp(-t * fenv)), a = 1 - Math.exp(-TAU * fc / SR);
        a1 += a * (s * 0.35 - a1); a2 += a * (a1 - a2);
        return a2 * env(t, 0.006, d);
      };
    },
    pad: (f, cut = 1500) => { let a1 = 0, a2 = 0; const a = 1 - Math.exp(-TAU * cut / SR); return t => { let s = 0; for (const dd of [-0.004, 0.004]) for (let k = 1; k <= 5; k++) s += Math.sin(TAU * f * (1 + dd) * k * t + k) / (k * k); a1 += a * (s - a1); a2 += a * (a1 - a2); return a2 * Math.min(1, t / 0.25); }; },
    // Karplus-Strong: gitara, tar, klavinet
    pluck: (f, { bright = 0.5, decay = 0.996 } = {}) => {
      const P = Math.max(2, Math.round(SR / f)), buf = new Float32Array(P); let p = 0;
      for (let i = 0; i < P; i++) { const x = nz(); p += (0.15 + bright * 0.85) * (x - p); buf[i] = p; }
      let k = 0;
      return () => { const a = buf[k], b = buf[(k + 1) % P]; buf[k] = decay * (a * (0.5 + bright * 0.35) + b * (0.5 - bright * 0.35)); k = (k + 1) % P; return a; };
    },
    b808: (f, d = 1.4) => { let ph = 0; return t => { ph += TAU * f * (1 + 1.2 * Math.exp(-t * 28)) / SR; return Math.tanh(Math.sin(ph) * 1.8) * env(t, 0.002, d); }; },
    log: f => { let ph = 0; return t => { ph += TAU * f * (1 + 1.1 * Math.exp(-t * 45)) / SR; return Math.tanh(2.4 * Math.sin(ph)) * env(t, 0.001, 7); }; },
    slap: f => { let ph = 0; return t => { ph += TAU * f / SR; return Math.tanh(1.6 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) * Math.exp(-t * 18) + 0.35 * Math.sin(3 * ph) * Math.exp(-t * 30))) * env(t, 0.002, 5); }; },
    bass: (f, d = 3) => t => (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2 * t)) * env(t, 0.004, d),
    // nağaralar
    kick: (base = 48, punch = 1, d = 8) => { let ph = 0; return t => { ph += TAU * (base + 95 * punch * Math.exp(-t * 32)) / SR; return Math.sin(ph) * Math.exp(-t * d) + (t < 0.003 ? nz() * 0.25 * punch : 0); }; },
    snare: (tone = 190, d = 16) => { let lp = 0; return t => { const x = nz(); lp += 0.45 * (x - lp); return (x - lp * 0.6) * Math.exp(-t * d) + 0.45 * Math.sin(TAU * tone * t) * Math.exp(-t * 28); }; },
    clap: () => { let lp = 0; return t => { const x = nz(); lp += 0.5 * (x - lp); const e = [0, 0.011, 0.022].reduce((m, o) => m + (t >= o ? Math.exp(-(t - o) * 120) : 0), 0) + (t > 0.022 ? Math.exp(-(t - 0.022) * 14) * 0.6 : 0); return (x - lp) * e; }; },
    hat: open => { let p = 0; return t => { const x = nz(), h = x - p; p = x; return h * Math.exp(-t * (open ? 9 : 55)); }; },
    shaker: () => { let p = 0; return t => { const x = nz(), h = x - p; p = x; return h * Math.min(1, t / 0.012) * Math.exp(-t * 32); }; },
    rim: () => t => (Math.sin(TAU * 1700 * t) * 0.6 + Math.sin(TAU * 820 * t) * 0.4) * Math.exp(-t * 60),
    conga: (f = 220) => { let ph = 0; return t => { ph += TAU * f * (1 + 0.3 * Math.exp(-t * 30)) / SR; return Math.sin(ph) * Math.exp(-t * 12); }; },
    dafDum: () => { let ph = 0; return t => { ph += TAU * (82 + 40 * Math.exp(-t * 40)) / SR; return Math.sin(ph) * Math.exp(-t * 9) + nz() * 0.08 * Math.exp(-t * 30); }; },
    dafTak: () => { let p = 0; return t => { const x = nz(), h = x - p; p = x; const jingle = (Math.sin(TAU * 3100 * t) + Math.sin(TAU * 4730 * t) * 0.8 + Math.sin(TAU * 6150 * t) * 0.6) * Math.exp(-t * 22); return h * Math.exp(-t * 35) * 0.8 + jingle * 0.25; }; },
    crash: () => { let p = 0; return t => { const x = nz(), h = x - p; p = x; return h * Math.exp(-t * 2.4); }; },
    riser: dur => { let p = 0; return t => { const x = nz(); p += (0.02 + 0.6 * (t / dur)) * (x - p); return p * Math.pow(t / dur, 2); }; }
  };

  // Sakit fon: bütün nağaralar xeyli yumşaq çalınır
  const CALM = 0.5;
  const drums = (pat, { k = [], s = [], c = [], h = [], o = [], sh = [], rm = [], cg = [] }, opt = {}) => {
    for (let b = 0; b < bars; b++) {
      if (!full(b)) continue;
      for (const x of k) { const t = at(b, x); kicks.push(t); play(t, 0.45, I.kick(opt.kb || 48, opt.kp || 1, opt.kd || 8), { gain: (opt.kg || 0.9) * CALM }); }
      for (const x of s) play(at(b, x), 0.35, I.snare(opt.st || 190, opt.sd || 16), { gain: (opt.sg || 0.32) * CALM, send: opt.ss || 0.15 });
      for (const x of c) play(at(b, x), 0.35, I.clap(), { gain: (opt.cg || 0.3) * CALM, send: 0.2 });
      for (const x of h) play(at(b, x), 0.06, I.hat(false), { gain: (x % 4 === 2 ? 0.11 : 0.07) * (opt.hg || 1) * CALM, pan: 0.2 });
      for (const x of o) play(at(b, x), 0.3, I.hat(true), { gain: 0.08 * (opt.hg || 1) * CALM, pan: -0.15 });
      for (const x of sh) play(at(b, x), 0.08, I.shaker(), { gain: (x % 4 === 2 ? 0.1 : 0.06) * CALM, pan: -0.3 });
      for (const x of rm) play(at(b, x), 0.08, I.rim(), { gain: 0.12 * CALM, pan: 0.25 });
      for (const [x, f] of cg) play(at(b, x), 0.3, I.conga(f), { gain: 0.22 * CALM, pan: -0.25 });
    }
  };
  const chordsEach = (fn) => { for (let b = 0; b < bars; b++) fn(b, prog[b % 4]); };
  const rootOf = (c, oct = -24) => { let n = c[0] + oct; while (n < 31) n += 12; return n; };
  // Melodiya: 2 xanalıq motiv, təkrar olunur, ikinci dəfə sonu dəyişir
  const melody = (play1, { density = 0.4, from = 7, range = 6, oct = 12, len = 2 } = {}) => {
    const steps = len * 16, motif = []; let d = from;
    for (let s = 0; s < steps; s++) if (s % 4 === 0 ? r() < density + 0.25 : r() < density * 0.5) { d = Math.max(from - range, Math.min(from + range, d + Math.round((r() - 0.5) * 4))); motif.push([s, d]); }
    if (!motif.length) motif.push([0, from]);
    for (let b = intro; b < last; b += len) {
      const variant = ((b - intro) / len) % 2 === 1;
      motif.forEach(([s, dd], i) => {
        const bb = b + Math.floor(s / 16); if (bb >= last) return;
        const next = motif[i + 1] ? motif[i + 1][0] : steps;
        const n = deg(dd + (variant && i >= motif.length - 2 ? 2 : 0)) + oct;
        play1(at(bb, s % 16), Math.max(0.12, (next - s) * st), n);
      });
    }
  };

  /* ---------- janrlar ---------- */
  if (G === 'lofi') {
    chordsEach((b, c) => { for (const [x, len] of [[0, 1.8], [10, 1.1]]) c.forEach((n, i) => play(at(b, x) + i * 0.012, beat * len * 2, I.epiano(mtof(n), 1.2), { gain: 0.07, pan: (i - 2) * 0.12, send: 0.3, duck: false })); });
    for (let b = intro; b < last; b++) for (const x of [0, 7, 10]) play(at(b, x), beat * 0.9, I.bass(mtof(rootOf(prog[b % 4]))), { gain: 0.28 });
    drums('', { k: [0, 7, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] }, { kb: 50, kd: 9, sd: 14, sg: 0.26, hg: 0.8 });
    melody((t, d, n) => play(t, d + 0.4, I.epiano(mtof(n), 2.2, 1), { gain: 0.06, pan: 0.2, send: 0.4 }), { density: 0.22, oct: 12 });
    for (let i = 0; i < N / SR * 9; i++) { const t = r() * N / SR; play(t, 0.004, () => nz(), { gain: 0.035 * r() }); }
  } else if (G === 'trap') {
    chordsEach((b, c) => { if (b % 2 === 0) c.forEach((n, i) => play(b * bar, bar * 2, I.pad(mtof(n - 12), 900), { gain: 0.045, pan: (i - 1) * 0.2, send: 0.3 })); });
    for (let b = intro; b < last; b++) for (const [x, len] of [[0, 6], [10, 4], [14, 2]]) play(at(b, x), len * st + 0.1, I.b808(mtof(rootOf(prog[b % 4], -36))), { gain: 0.38 });
    const hh = []; for (let s = 0; s < 16; s += 2) hh.push(s);
    drums('', { k: [0, 10], c: [8], h: hh }, { kb: 45, kd: 10, kg: 0.6, cg: 0.32 });
    melody((t, d, n) => play(t, d + 0.6, I.bell(mtof(n), 1.6), { gain: 0.1, pan: -0.15, send: 0.35 }), { density: 0.35, oct: 12 });
  } else if (G === 'house') {
    chordsEach((b, c) => { for (const x of [3, 6, 11]) c.forEach((n, i) => play(at(b, x), st * 2.5, I.saw(mtof(n), { cut: 3200, d: 7, H: 8 }), { gain: 0.06, pan: (i - 1.5) * 0.15, send: 0.25, duck: true })); });
    chordsEach((b, c) => { if (b % 2 === 0) c.forEach(n => play(b * bar, bar * 2, I.pad(mtof(n), 1200), { gain: 0.03, send: 0.4, duck: true })); });
    for (let b = intro; b < last; b++) for (const x of [2, 6, 10, 14]) play(at(b, x), st * 1.6, I.saw(mtof(rootOf(prog[b % 4], -24)), { cut: 700, d: 6, H: 10 }), { gain: 0.22, duck: true });
    drums('', { k: [0, 4, 8, 12], c: [4, 12], o: [2, 6, 10, 14], h: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15] }, { kb: 46, kd: 8, kg: 0.95, hg: 0.6 });
  } else if (G === 'afro') {
    chordsEach((b, c) => { for (const x of [0, 7, 10]) c.forEach((n, i) => play(at(b, x), st * 3, I.epiano(mtof(n), 3, 1.1), { gain: 0.055, pan: (i - 1.5) * 0.15, send: 0.25, duck: true })); });
    for (let b = intro; b < last; b++) { const rt = rootOf(prog[b % 4], -24); for (const [x, o] of [[0, 0], [3, 7], [6, 12], [10, 0], [13, 7]]) play(at(b, x), st * 2.4, I.log(mtof(rt + o)), { gain: 0.32, duck: true }); }
    const sh = []; for (let s = 0; s < 16; s++) sh.push(s);
    drums('', { k: [0, 7, 8], rm: [3, 6, 11, 14], sh, cg: [[5, 240], [13, 200], [15, 300]] }, { kb: 50, kd: 9, kg: 0.75 });
    melody((t, d, n) => play(t, 0.5, I.marimba(mtof(n)), { gain: 0.12, pan: 0.2, send: 0.2 }), { density: 0.45, oct: 12 });
  } else if (G === 'synthwave') {
    chordsEach((b, c) => c.forEach((n, i) => play(b * bar, bar, I.pad(mtof(n), 1600), { gain: 0.04, pan: (i - 1) * 0.25, send: 0.45, duck: true })));
    for (let b = intro; b < last; b++) { const c = prog[b % 4]; for (let s = 0; s < 16; s++) play(at(b, s), st * 0.9, I.saw(mtof(c[s % c.length] + 12), { cut: 2600 + 800 * Math.sin(b + s / 4), d: 9, H: 9 }), { gain: 0.05, pan: s % 2 ? 0.3 : -0.3, send: 0.35 }); }
    for (let b = intro; b < last; b++) for (let s = 0; s < 16; s += 2) play(at(b, s), st * 1.7, I.saw(mtof(rootOf(prog[b % 4], -24)), { cut: 600, d: 5, H: 10 }), { gain: 0.2, duck: true });
    drums('', { k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] }, { kb: 48, kd: 8, sd: 9, sg: 0.36, ss: 0.5, hg: 0.8 });
    melody((t, d, n) => play(t, d, I.saw(mtof(n), { cut: 3400, d: 1.2, H: 10 }), { gain: 0.07, send: 0.45 }), { density: 0.18, oct: 12 });
  } else if (G === 'acoustic') {
    chordsEach((b, c) => { for (const [x, up] of [[0, 0], [3, 1], [6, 0], [8, 1], [10, 0], [12, 1], [14, 0]]) { if (!full(b) && x > 0) continue; const notes = up ? [...c].reverse() : c; notes.forEach((n, i) => play(at(b, x) + i * 0.013, 0.9, I.pluck(mtof(n), { bright: 0.45, decay: 0.994 }), { gain: x % 4 ? 0.07 : 0.1, pan: (i - 1.5) * 0.12, send: 0.15 })); } });
    for (let b = intro; b < last; b++) for (const x of [0, 8, 11]) play(at(b, x), beat, I.bass(mtof(rootOf(prog[b % 4]))), { gain: 0.24 });
    const sh = []; for (let s = 0; s < 16; s++) sh.push(s);
    drums('', { k: [0, 8], c: [4, 12], sh }, { kb: 52, kd: 10, kg: 0.6, cg: 0.25 });
    melody((t, d, n) => play(t, 1.2, I.bell(mtof(n), 3.2), { gain: 0.07, pan: 0.25, send: 0.3 }), { density: 0.2, oct: 24 });
  } else if (G === 'mugham') {
    for (let b = 0; b < bars; b++) for (const n of [tonic - 12, tonic - 5]) play(b * bar, bar + 0.05, I.pad(mtof(n), 900), { gain: 0.05, send: 0.4 });
    chordsEach((b, c) => { if (full(b)) c.forEach((n, i) => play(at(b, 0) + i * 0.02, 1.4, I.pluck(mtof(n), { bright: 0.75, decay: 0.997 }), { gain: 0.06, pan: (i - 1) * 0.2, send: 0.25 })); });
    for (let b = intro; b < last; b++) play(b * bar, bar, I.bass(mtof(tonic - 24), 1.2), { gain: 0.25 });
    for (let b = 0; b < bars; b++) { if (!full(b)) continue; for (const x of [0, 6, 10]) play(at(b, x), 0.5, I.dafDum(), { gain: 0.45 * CALM }); for (const x of [3, 4, 8, 12, 14]) play(at(b, x), 0.25, I.dafTak(), { gain: 0.16 * CALM, pan: 0.2 }); }
    drums('', { k: [0, 8] }, { kb: 46, kd: 10, kg: 0.45 });
    // tar: sürətli bəzəkli melodiya (grace note + tremolo)
    melody((t, d, n) => { play(t - 0.045, 0.06, I.pluck(mtof(n + 1), { bright: 0.85, decay: 0.99 }), { gain: 0.06, pan: 0.15 }); const reps = d > 0.5 ? 3 : 1; for (let q = 0; q < reps; q++) play(t + q * 0.075, Math.min(1.2, d + 0.3), I.pluck(mtof(n), { bright: 0.85, decay: 0.997 }), { gain: q ? 0.07 : 0.13, pan: 0.15, send: 0.25 }); }, { density: 0.5, oct: 12, range: 5 });
  } else if (G === 'funk') {
    for (let b = intro; b < last; b++) { const c = prog[b % 4]; for (const x of [2, 5, 7, 10, 13]) c.slice(1, 4).forEach((n, i) => play(at(b, x), st * 0.9, I.pluck(mtof(n), { bright: 0.9, decay: 0.985 }), { gain: 0.07, pan: 0.3 - i * 0.1, send: 0.1 })); }
    for (let b = intro; b < last; b++) { const rt = rootOf(prog[b % 4], -24); for (const [x, o] of [[0, 0], [3, 12], [6, 0], [7, 12], [10, 0], [12, 10], [14, 12]]) play(at(b, x), st * 1.4, I.slap(mtof(rt + o)), { gain: 0.24 }); }
    chordsEach((b, c) => { if (b % 2 === 0) c.forEach(n => play(b * bar, bar * 2, I.pad(mtof(n), 1300), { gain: 0.022, send: 0.35 })); });
    const hh = []; for (let s = 0; s < 16; s++) hh.push(s);
    drums('', { k: [0, 7, 10], s: [4, 12], h: hh }, { kb: 50, kd: 10, sg: 0.34, hg: 0.7 });
    for (let b = intro; b < last; b++) for (const x of [9, 15]) play(at(b, x), 0.12, I.snare(200, 30), { gain: 0.07 * CALM });
    for (let b = intro + 1; b < last; b += 2) prog[b % 4].slice(1, 4).forEach(n => play(at(b, 14), st * 2, I.saw(mtof(n + 12), { cut: 3000, d: 6, H: 10 }), { gain: 0.05, send: 0.3 }));
  }

  // Sonluq: son xanada akkord səslənib sönür
  prog[last % 4].forEach((n, i) => play(last * bar + i * 0.015, bar + tail - 0.2, G === 'acoustic' || G === 'mugham' ? I.pluck(mtof(n), { bright: 0.5, decay: 0.9985 }) : I.epiano(mtof(n), 0.9, 1.2), { gain: 0.07, pan: (i - 1.5) * 0.15, send: 0.45 }));
  play(last * bar, 0.5, I.kick(48, 1, 7), { gain: 0.3 });

  // Səhnə keçidləri: əvvəl qısa "riser", sonra zərb (crash + kick)
  for (const m of marks) {
    if (m <= 0 || m >= bars) continue;
    const t = m * bar, rl = Math.min(beat * 2, bar * 0.5);
    play(t - rl, rl, I.riser(rl), { gain: 0.05, send: 0.3 });
    play(t, 1.6, I.crash(), { gain: 0.04, pan: 0.1, send: 0.3 });
  }

  // Kick vuranda akkordlar səngiyir (sidechain)
  kicks.sort((a, b) => a - b);
  let ki = -1;
  const rvL = reverb(VL, 1), rvR = reverb(VR, 1.037);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++;
    const dk = ki >= 0 ? 1 - 0.6 * Math.exp(-(t - kicks[ki]) * 9) : 1;
    L[i] += DL[i] * dk + rvL[i] * 0.9; R[i] += DR[i] * dk + rvR[i] * 0.9;
  }

  // Master: yumşaq limitləmə, giriş/çıxış fade, 16-bit WAV
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 0.9); R[i] = Math.tanh(R[i] * 0.9); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const gn = 0.72 / (peak || 1), fadeIn = 0.4 * SR, fadeOut = 1.8 * SR;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const e = Math.min(1, i / fadeIn, (N - i) / fadeOut);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gn * e)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gn * e)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
  return { seconds: N / SR, key, bpm, genre: G };
}
