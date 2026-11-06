// Fon musiqisi generatoru: hər video üçün öz musiqisini yaradır (müəllif hüququ problemi yoxdur).
// Akkordlar, temp və tonallıq "seed"-ə görə dəyişir, ona görə hər gün bir az fərqli səslənir.
// İstifadə: import { makeMusic } from './music.mjs'; makeMusic({ seed, bpm, bars, file })
import fs from 'node:fs';

const SR = 44100;
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

// Sadə, təkrarlanan təsadüfi ədədlər (eyni seed = eyni musiqi)
function rng(seed) {
  let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Akkord ardıcıllıqları (C majorda, sonra tonallığa sürüşdürülür): pozitiv, müasir səs
const PROGS = [
  [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]], // Am F C G
  [[48, 55, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], // C G Am F
  [[53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69]], // F G Em Am
  [[48, 52, 55, 62], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]]  // Cadd9 Am7 Fmaj7 G7
];

export function makeMusic({ seed = 'rezet', bpm = 100, bars = 12, file, tail = 1.5 }) {
  const r = rng(seed);
  const key = [-3, -2, 0, 2, 3][Math.floor(r() * 5)];
  const prog = PROGS[Math.floor(r() * PROGS.length)].map(c => c.map(n => n + key));
  const beat = 60 / bpm, bar = beat * 4, len = bars * bar + tail, N = Math.ceil(len * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const add = (i, l, rr = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += rr; } };
  const intro = 2, outroFrom = bars - 1;
  const full = b => b >= intro && b < outroFrom;

  // 1) Pad: isti, yumşaq akkordlar (harmoniklər + yüngül detune), akkord dəyişəndə yumşaq keçid
  const padLP = [0, 0];
  for (let i = 0; i < N; i++) {
    const t = i / SR, b = Math.min(bars - 1, Math.floor(t / bar)), within = t - b * bar;
    const chord = prog[b % 4], prev = prog[(b + 3) % 4];
    const xf = Math.min(1, within / 0.25);
    let s = 0;
    for (const [c, w] of [[chord, xf], [prev, 1 - xf]]) {
      if (w <= 0) continue;
      for (const n of c) for (const d of [-0.0025, 0.0025]) {
        const f = mtof(n) * (1 + d);
        for (let k = 1; k <= 5; k++) s += w * Math.sin(2 * Math.PI * f * k * t + k) / (k * k * 1.6);
      }
    }
    // Barabanın vurduğu anda pad bir az səngiyir (müasir "nəfəs alan" effekt)
    const pos = (t % beat) / beat, duck = full(b) ? 0.55 + 0.45 * Math.min(1, pos * 3.2) : 1;
    const a = 1 - Math.exp(-2 * Math.PI * 1400 / SR);
    padLP[0] += a * (s - padLP[0]); padLP[1] += a * (padLP[0] - padLP[1]);
    const v = padLP[1] * 0.05 * duck;
    add(i, v * (1 + 0.15 * Math.sin(t * 0.7)), v * (1 - 0.15 * Math.sin(t * 0.7)));
  }

  // 2) Arpecio (pluck): akkord səsləri 8-lik notlarla, səs-küydən uzaq, stereo əks-səda ilə
  const arpL = new Float32Array(N), arpR = new Float32Array(N);
  const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
  for (let b = 0; b < bars; b++) {
    for (let e = 0; e < 8; e++) {
      if (b === bars - 1 && e > 3) break;
      const n = prog[b % 4][pattern[e]] + 12, f = mtof(n), st = Math.round((b * bar + e * beat / 2) * SR);
      const dur = Math.round(0.45 * SR), vel = (e % 2 ? 0.75 : 1) * (0.9 + r() * 0.2), pan = e % 2 ? 0.35 : -0.35;
      for (let j = 0; j < dur; j++) {
        const t = j / SR, env = Math.exp(-t * 9) * Math.min(1, t * 400);
        const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
        const v = (tri * 0.7 + Math.sin(4 * Math.PI * f * t) * 0.15) * env * vel * 0.09;
        if (st + j < N) { arpL[st + j] += v * (1 - pan); arpR[st + j] += v * (1 + pan); }
      }
    }
  }
  const dl = Math.round(beat * 0.75 * SR);
  for (let i = 0; i < N; i++) {
    const l = arpL[i] + (i >= dl ? arpR[i - dl] * 0.38 : 0), rr = arpR[i] + (i >= dl ? arpL[i - dl] * 0.38 : 0);
    arpL[i] = l; arpR[i] = rr; add(i, l, rr);
  }

  // 3) Bas: akkordun əsas notu, hər vuruşda yumşaq
  for (let b = intro; b < outroFrom; b++) {
    const root = prog[b % 4][0] - 24 + (prog[b % 4][0] - 24 < 33 ? 12 : 0), f = mtof(root);
    for (const q of [0, 1.5, 2, 3, 3.5]) {
      const st = Math.round((b * bar + q * beat) * SR), dur = Math.round(beat * 0.9 * SR);
      for (let j = 0; j < dur; j++) {
        const t = j / SR, env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
        add(st + j, (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * env * 0.16);
      }
    }
  }

  // 4) Nağaralar: kick (1 və 3), clap (2 və 4), hi-hat (8-lik)
  let noiseSeed = 1; const noise = () => { noiseSeed = (noiseSeed * 16807) % 2147483647; return noiseSeed / 1073741823.5 - 1; };
  for (let b = intro; b < outroFrom; b++) {
    for (let q = 0; q < 4; q++) {
      const st = Math.round((b * bar + q * beat) * SR);
      if (q === 0 || q === 2) {
        let ph = 0;
        for (let j = 0; j < 0.35 * SR; j++) { const t = j / SR, f = 45 + 75 * Math.exp(-t * 35); ph += 2 * Math.PI * f / SR; add(st + j, Math.sin(ph) * Math.exp(-t * 9) * 0.42); }
      }
      if (q === 1 || q === 3) {
        let lp = 0;
        for (let j = 0; j < 0.22 * SR; j++) { const t = j / SR, x = noise(); lp += 0.35 * (x - lp); const env = Math.exp(-t * 18) * (1 + 0.6 * Math.exp(-((t - 0.012) ** 2) / 0.00002)); add(st + j, (x - lp) * env * 0.12, (x - lp) * env * 0.12); }
      }
      for (const h of [0, 0.5]) {
        const hs = Math.round((b * bar + (q + h) * beat) * SR); let prev = 0;
        for (let j = 0; j < 0.06 * SR; j++) { const x = noise(), hp = x - prev; prev = x; const v = hp * Math.exp(-j / SR * 60) * (h ? 0.035 : 0.025); add(hs + j, v * 0.8, v * 1.2); }
      }
    }
  }

  // 5) Master: yumşaq limitləmə, giriş/çıxış fade, 16-bit WAV
  let peak = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.3); R[i] = Math.tanh(R[i] * 1.3); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  const g = 0.85 / (peak || 1), fadeIn = 0.6 * SR, fadeOut = 2.2 * SR;
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const env = Math.min(1, i / fadeIn, (N - i) / fadeOut);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * env)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * env)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
  return { seconds: len, key, bpm };
}
