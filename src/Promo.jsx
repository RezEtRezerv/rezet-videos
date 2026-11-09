import React from 'react';
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { clockWipe } from '@remotion/transitions/clock-wipe';
import { iris } from '@remotion/transitions/iris';
import { pushCut } from '@remotion/transitions/push-cut';
import { loadFont as inter } from '@remotion/google-fonts/Inter';
import { loadFont as montserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as unbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as rubik } from '@remotion/google-fonts/Rubik';
import { loadFont as bricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as sora } from '@remotion/google-fonts/Sora';
import { loadFont as oswald } from '@remotion/google-fonts/Oswald';
import { loadFont as archivo } from '@remotion/google-fonts/Archivo';

// Hər gün Claude şrift, rəng palitrası, fon, mətn animasiyası, keçid və sonluq seçir: heç bir video eyni görünmür.
const fo = w => ({ weights: w, subsets: ['latin', 'latin-ext'] });
// size: geniş şriftlər bir az kiçilir ki, mətn ekrandan çıxmasın
export const FONTS = {
  inter: { family: inter('normal', fo(['500', '700', '800', '900'])).fontFamily, size: 1 },
  montserrat: { family: montserrat('normal', fo(['500', '700', '800', '900'])).fontFamily, size: 0.94 },
  unbounded: { family: unbounded('normal', fo(['500', '700', '800', '900'])).fontFamily, size: 0.8 },
  rubik: { family: rubik('normal', fo(['500', '700', '800', '900'])).fontFamily, size: 1 },
  bricolage: { family: bricolage('normal', fo(['500', '700', '800'])).fontFamily, size: 1 },
  sora: { family: sora('normal', fo(['500', '700', '800'])).fontFamily, size: 0.92 },
  oswald: { family: oswald('normal', fo(['500', '600', '700'])).fontFamily, size: 1.12, upper: true },
  archivo: { family: archivo('normal', fo(['500', '700', '800', '900'])).fontFamily, size: 0.98 }
};
// accent: vurğu rəngi, on: vurğu üzərində mətn rəngi
export const PALETTES = {
  forest: { a: '#0B4D3D', b: '#062A21', glow: '#1E8F6E', accent: '#3DDC97', on: '#062A21' },
  midnight: { a: '#16294A', b: '#070D1C', glow: '#2B5DA8', accent: '#7CC4FF', on: '#06142B' },
  sunset: { a: '#8A3324', b: '#1C0E0A', glow: '#C2593A', accent: '#FFC857', on: '#2A1400' },
  plum: { a: '#4B2366', b: '#12091C', glow: '#7B4BB0', accent: '#FF8FD1', on: '#2A0A22' },
  electric: { a: '#1E2BFF', b: '#070A3D', glow: '#4D5BFF', accent: '#FFE14D', on: '#1A1500' },
  tangerine: { a: '#E8590C', b: '#5C1A00', glow: '#FF8A3D', accent: '#FFF3C4', on: '#4A1400' },
  hotpink: { a: '#D6206F', b: '#4D0628', glow: '#FF4F9A', accent: '#FFE600', on: '#3A0020' },
  noir: { a: '#1C1C1C', b: '#000000', glow: '#333333', accent: '#C6FF00', on: '#0D1400' },
  ocean: { a: '#00727A', b: '#002B33', glow: '#00A3AD', accent: '#FFD166', on: '#2A1F00' },
  cherry: { a: '#B81D36', b: '#3D0712', glow: '#E0344F', accent: '#FFE8D6', on: '#3D0712' },
  royal: { a: '#5B2EFF', b: '#160A4D', glow: '#7A57FF', accent: '#3DFFC5', on: '#062A21' }
};
const S = { look: 'glow', anim: 'rise', cta: 'center', trans: 'slide', size: 1, upper: false };
const P = { ...PALETTES.forest };

export const FPS = 30;
export const T = 18; // keçid uzunluğu (kadr)
const C = { g: '#0D5E4A', deep: '#062A21', mint: '#3DDC97', gold: '#F5B83D', red: '#FF5A5F', ink: '#10231D', paper: '#F4F8F6' };
export const sceneFrames = s => s.frames || Math.ceil((s.seconds + 0.7) * FPS) + T;
export const totalFrames = scenes => scenes.reduce((n, s) => n + sceneFrames(s), 0) - T * (scenes.length - 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
// Uzun mətn avtomatik kiçilir ki, heç vaxt kənara çıxmasın
export const fit = (text, base, ideal) => { const n = String(text || '').length, b = base * S.size; return n <= ideal ? Math.round(b) : Math.round(Math.max(b * 0.66, b * Math.sqrt(ideal / n))); };
const useSpring = (delay = 0, config = { damping: 14, mass: 0.7 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config });
};

/* ---------- fon: hər gün fərqli üslub ---------- */
const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="240" height="240" filter="url(#n)" opacity=".5"/></svg>')}")`;
const Bg = () => {
  const f = useCurrentFrame();
  const blob = (x, y, r, c, sp, ph) => (
    <div style={{ position: 'absolute', left: x + Math.sin(f / sp + ph) * 120, top: y + Math.cos(f / (sp * 1.3) + ph) * 140, width: r, height: r, borderRadius: '50%', background: c, filter: 'blur(120px)', opacity: 0.55 }} />
  );
  if (S.look === 'grid') return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${P.b} 0%, ${P.a} 58%, ${P.b} 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 240, top: 640, width: 600, height: 600, borderRadius: '50%', background: `linear-gradient(180deg, ${P.accent} 0%, ${P.glow} 100%)`, opacity: 0.35, filter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', left: -1080, right: -1080, top: 1060, height: 1400, transform: 'perspective(500px) rotateX(62deg)', transformOrigin: 'top center', backgroundImage: `linear-gradient(${P.accent}88 3px, transparent 3px), linear-gradient(90deg, ${P.accent}88 3px, transparent 3px)`, backgroundSize: '120px 120px', backgroundPosition: `0 ${(f * 4) % 120}px` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, transparent 50%, ${P.b} 100%)` }} />
    </AbsoluteFill>
  );
  if (S.look === 'bold') return (
    <AbsoluteFill style={{ background: P.a, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 520, top: -260, width: 1000, height: 1000, borderRadius: '50%', background: P.b, opacity: 0.55, transform: `translateY(${Math.sin(f / 50) * 60}px)` }} />
      <div style={{ position: 'absolute', left: -300, top: 1250, width: 900, height: 900, borderRadius: '50%', border: `70px solid ${P.accent}`, opacity: 0.18, transform: `rotate(${f / 3}deg)` }} />
      <div style={{ position: 'absolute', left: -200, right: -200, top: 1450, height: 180, background: P.glow, opacity: 0.35, transform: `rotate(-8deg) translateX(${Math.sin(f / 40) * 80}px)` }} />
    </AbsoluteFill>
  );
  if (S.look === 'grain') return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 30% 20%, ${P.glow} 0%, ${P.a} 40%, ${P.b} 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -400, left: -600 + ((f * 6) % 2600), width: 500, height: 2800, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent)', transform: 'rotate(18deg)' }} />
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.22, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  );
  if (S.look === 'stripes') return (
    <AbsoluteFill style={{ background: P.b, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(135deg, ${P.a} 0 90px, ${P.b} 90px 180px)`, backgroundPosition: `${f * 3}px 0`, opacity: 0.85 }} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 50% at 50% 45%, transparent 0%, ${P.b}EE 100%)` }} />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, ${P.a} 0%, ${P.b} 70%)`, overflow: 'hidden' }}>
      {blob(-200, 100, 700, P.glow, 70, 0)}
      {blob(500, 1100, 800, P.a, 90, 2)}
      {blob(300, 600, 500, P.accent + '40', 60, 4)}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 2px, transparent 2px)', backgroundSize: '44px 44px' }} />
    </AbsoluteFill>
  );
};

/* ---------- real video fonu: hər səhnənin öz klipi, yavaş zoom, tünd örtük ---------- */
const Footage = ({ src, frames }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const z = interpolate(f, [0, durationInFrames], [1.04, 1.16]);
  const vid = <OffthreadVideo src={staticFile(src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: P.b }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>{frames && frames < durationInFrames ? <Loop durationInFrames={frames}>{vid}</Loop> : vid}</AbsoluteFill>
      <AbsoluteFill style={{ background: P.a, opacity: 0.3, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.4) 42%, rgba(0,0,0,.78) 100%)' }} />
    </AbsoluteFill>
  );
};

/* ---------- başlıq: sözlər bir-bir yuxarı qalxır ---------- */
// Animasiya üslubu hər gün dəyişir: rise | pop | slam | type | mask | highlight
const Title = ({ text, top = 200, size = 82, delay = 4 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const words = String(text || '').split(' ');
  const base = { position: 'absolute', top, left: 70, right: 70, textAlign: 'center', textWrap: 'balance', fontSize: fit(text, size, 34), fontWeight: 900, lineHeight: 1.08, letterSpacing: S.upper ? '0' : '-0.02em', color: '#fff', textTransform: S.upper ? 'uppercase' : undefined };
  if (S.anim === 'type') {
    const n = Math.floor(Math.max(0, f - delay) * 1.5);
    return <div style={base}>{text.slice(0, n)}<span style={{ color: C.mint, opacity: f % 16 < 9 ? 1 : 0 }}>|</span><span style={{ opacity: 0 }}>{text.slice(n)}</span></div>;
  }
  if (S.anim === 'slam') {
    const p = spring({ frame: f - delay, fps, config: { damping: 9, mass: 0.9 } });
    const shake = f - delay > 4 && f - delay < 14 ? Math.sin(f * 2.3) * 6 : 0;
    return <div style={{ ...base, opacity: Math.min(1, p * 2), transform: `scale(${2.1 - p * 1.1}) translateX(${shake}px)` }}>{text}</div>;
  }
  return (
    <div style={base}>
      {words.map((w, i) => {
        const p = spring({ frame: f - delay - i * 5, fps, config: S.anim === 'pop' ? { damping: 8, mass: 0.6 } : { damping: 15, mass: 0.8 } });
        const hi = S.anim === 'highlight' && i >= words.length - 2;
        if (S.anim === 'mask') return <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', marginRight: '0.25em', paddingBottom: '0.08em' }}><span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)` }}>{w}</span></span>;
        if (S.anim === 'pop') return <span key={i} style={{ display: 'inline-block', marginRight: '0.25em', transform: `scale(${p})`, opacity: Math.min(1, p * 1.5) }}>{w}</span>;
        const hp = hi ? interpolate(f, [delay + words.length * 5, delay + words.length * 5 + 10], [0, 1], clamp) : 0;
        return <span key={i} style={{ display: 'inline-block', position: 'relative', isolation: 'isolate', marginRight: '0.25em', opacity: p, transform: `translateY(${(1 - p) * 50}px)`, color: hi && hp > 0.5 ? C.deep : w === '—' ? C.mint : undefined }}>
          {hi && <span style={{ position: 'absolute', left: '-0.1em', right: '-0.1em', top: '0.08em', bottom: '0.02em', background: C.mint, borderRadius: 8, transform: `scaleX(${hp})`, transformOrigin: 'left', zIndex: -1 }} />}{w}</span>;
      })}
    </div>
  );
};

/* ---------- altyazı: danışılan söz yaşıl rənglə seçilir ---------- */
const Subs = ({ words }) => {
  const f = useCurrentFrame(), t = f / FPS;
  if (!words?.length) return null;
  const lines = [];
  let cur = [];
  // Sətir cümlə sonunda və ya 4 sözdə bölünür; cümlənin son sözü tək qalmasın deyə 5-ə qədər uzanır
  words.forEach((w, i) => { cur.push(w); const next = words[i + 1]; if (w.p || (cur.length >= 4 && !(next && next.p && cur.length < 5))) { lines.push(cur); cur = []; } });
  if (cur.length) lines.push(cur);
  let li = lines.findIndex(l => t < l[l.length - 1].t + l[l.length - 1].d + 0.15);
  if (li < 0) li = lines.length - 1;
  const line = lines[li], start = line[0].t;
  const p = interpolate(t, [start - 0.1, start + 0.1], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 330, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(3,20,15,.62)', borderRadius: 26, padding: '18px 30px', fontSize: 50, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.25, opacity: p, transform: `scale(${0.96 + p * 0.04})` }}>
        {line.map((w, i) => {
          const on = t >= w.t - 0.03;
          return <span key={i} style={{ color: on ? (t < w.t + w.d + 0.05 ? C.mint : '#fff') : 'rgba(255,255,255,.45)', marginRight: '0.28em' }}>{w.w}</span>;
        })}
      </div>
    </div>
  );
};

/* ---------- səssiz versiyada alt yazı: səhnənin əsas fikri, başlıqdan sonra çıxır ---------- */
const Line = ({ text, delay = 34 }) => {
  const p = useSpring(delay, { damping: 18 });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, bottom: 330, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(3,20,15,.62)', borderRadius: 26, padding: '20px 34px', fontSize: fit(text, 48, 50), fontWeight: 800, color: '#fff', textAlign: 'center', textWrap: 'balance', lineHeight: 1.25, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>{text}</div>
    </div>
  );
};

/* ---------- ikonlar ---------- */
const Ic = {
  phone: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /><path d="m16 2 6 6M22 2l-6 6" /></svg>,
  cal: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M8 15h2M14 15h2" /></svg>,
  mail: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m22 7-10 6L2 7" /></svg>,
  clock: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  chart: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  users: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></svg>,
  star: c => <svg width="100%" height="100%" viewBox="0 0 24 24" fill={c}><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
};

/* ---------- 1: buraxılmış zənglər ---------- */
const Calls = ({ s, l }) => {
  const f = useCurrentFrame();
  const ring = f < 70 ? Math.sin(f * 1.6) * 10 * interpolate(f, [0, 70], [1, 0.3]) : 0;
  const ic = useSpring(0);
  const badge = useSpring(150);
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={190} />
      <div style={{ position: 'absolute', top: 560, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 190, height: 190, borderRadius: '50%', background: C.red, padding: 46, transform: `scale(${ic}) rotate(${ring}deg)`, boxShadow: `0 0 0 ${20 + Math.sin(f / 4) * 10}px ${C.red}33` }}>{Ic.phone('#fff')}</div>
      </div>
      {[0, 1, 2].map(i => {
        const p = useSpring(45 + i * 28);
        return (
          <div key={i} style={{ position: 'absolute', left: 110, right: 110, top: 840 + i * 150, height: 124, borderRadius: 30, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 32px', opacity: p, transform: `translateX(${(1 - p) * 300}px) scale(${0.9 + p * 0.1})`, boxShadow: '0 20px 40px rgba(0,0,0,.25)' }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: '#FFE8E9', padding: 15 }}>{Ic.phone(C.red)}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 36, fontWeight: 800, color: C.ink }}>{l.missed}</div><div style={{ fontSize: 28, color: '#6B7C76', fontWeight: 500 }}>{l.caller}</div></div>
            <div style={{ fontSize: 26, color: '#6B7C76', fontWeight: 700, whiteSpace: 'nowrap' }}>{l.ago[i]}</div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', top: 1310, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: C.red, color: '#fff', fontSize: 40, fontWeight: 800, padding: '16px 34px', borderRadius: 999, transform: `scale(${badge})` }}>{s.badge}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 2: telefonda rezerv ---------- */
const Ripple = ({ at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 16], [0, 1], clamp);
  if (f < at - 10 || p >= 1) return null;
  const come = interpolate(f, [at - 10, at], [0, 1], clamp);
  return <div style={{ position: 'absolute', left: '50%', top: '50%', width: 90, height: 90, margin: -45, borderRadius: '50%', background: 'rgba(13,94,74,.3)', border: '4px solid rgba(13,94,74,.55)', opacity: come * (1 - p), transform: `scale(${0.6 + p * 1.2})`, pointerEvents: 'none' }} />;
};
const Phone = ({ s, l }) => {
  const list = s.services?.length === 3 ? s.services : [{ name: 'Saç kəsimi', price: 15 }, { name: s.service, price: 25 }, { name: 'Uşaq saç kəsimi', price: 10 }];
  const pick = Number.isInteger(s.pick) ? s.pick : 1, chosen = list[pick].name;
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const enter = interpolate(f, [14, 38], [0, 1], { ...clamp, easing: ease });
  const float = Math.sin(f / 45) * 6 * enter;
  const t1 = Math.round(durationInFrames * 0.27), t2 = Math.round(durationInFrames * 0.5), t3 = Math.round(durationInFrames * 0.66);
  const io = { ...clamp, easing: Easing.inOut(Easing.cubic) };
  const a = interpolate(f, [t1 + 6, t1 + 18], [1, 0], io), b = interpolate(f, [t1 + 12, t1 + 26], [0, 1], io) * interpolate(f, [t3, t3 + 12], [1, 0], io);
  const picked = f > t2 - 2, pressed = f > t3 - 6 && f < t3;
  const ok = useSpring(t3 + 4), check = interpolate(f, [t3 + 8, t3 + 26], [60, 0], clamp);
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '15:30', '16:00'];
  const W = 540, H = 990;
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={170} size={76} />
      <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 380, width: W, height: H, opacity: enter, transform: `translateY(${(1 - enter) * 140 + float}px) scale(${0.94 + enter * 0.06})` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 74, background: '#0B1512', boxShadow: '0 40px 90px rgba(0,0,0,.5), inset 0 0 0 3px #2A3A35' }} />
        <div style={{ position: 'absolute', inset: 16, borderRadius: 60, background: C.paper, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: '#0B1512', zIndex: 5 }} />
          {s.bookedAt && <div style={{ position: 'absolute', top: 22, left: 40, fontSize: 24, fontWeight: 800, color: '#fff', zIndex: 6 }}>{s.bookedAt}</div>}
          <div style={{ background: C.g, color: '#fff', padding: '86px 34px 30px' }}>
            <div style={{ fontSize: 24, opacity: 0.75, fontWeight: 700 }}>RezEt</div>
            <div style={{ fontSize: fit(s.biz, 38, 20), fontWeight: 900, marginTop: 6 }}>{s.biz}</div>
            <div style={{ fontSize: 24, marginTop: 8, color: C.gold }}>★★★★★ <span style={{ color: '#fff', opacity: 0.8 }}>4.9</span></div>
          </div>
          {/* xidmətlər */}
          <div style={{ position: 'absolute', top: 260, left: 26, right: 26, opacity: a, transform: `translateX(${(1 - a) * -80}px)` }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.ink, margin: '6px 0 18px' }}>{l.choose}</div>
            {list.map(({ name: x, price }, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 22, padding: '24px 24px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', fontSize: 28, fontWeight: 800, color: C.ink, position: 'relative', background: i === pick && f > t1 - 2 ? '#E3F4EE' : '#fff', border: i === pick && f > t1 - 2 ? `3px solid ${C.g}` : '3px solid #E2EBE7' }}>
                {i === pick && <Ripple at={t1 - 8} />}<span>{x}</span><span style={{ color: C.g }}>{price} {l.cur}</span>
              </div>
            ))}
          </div>
          {/* vaxtlar */}
          <div style={{ position: 'absolute', top: 260, left: 26, right: 26, opacity: b, transform: `translateX(${(1 - b) * 80}px)` }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.ink, margin: '6px 0 18px' }}>{l.chooseTime}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {slots.map(x => {
                const on = x === s.time && picked;
                return <div key={x} style={{ position: 'relative', borderRadius: 18, padding: '22px 0', textAlign: 'center', fontSize: 28, fontWeight: 800, background: on ? C.g : '#fff', color: on ? '#fff' : C.ink, border: `3px solid ${on ? C.g : '#E2EBE7'}`, transform: on ? `scale(${1 + 0.06 * Math.max(0, 1 - (f - t2) / 8)})` : undefined }}>{x === s.time && <Ripple at={t2 - 8} />}{x}</div>;
              })}
            </div>
            <div style={{ position: 'relative', marginTop: 26, borderRadius: 22, padding: '26px 0', textAlign: 'center', background: picked ? (pressed ? '#0A4A3A' : C.g) : '#B8C9C2', color: '#fff', fontSize: 30, fontWeight: 900, transform: pressed ? 'scale(.97)' : undefined }}><Ripple at={t3 - 8} />{l.confirm}</div>
          </div>
          {/* təsdiq */}
          {f > t3 && (
            <div style={{ position: 'absolute', top: 290, left: 26, right: 26, textAlign: 'center', opacity: ok, transform: `scale(${0.85 + ok * 0.15})` }}>
              <svg width="190" height="190" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill={C.g} /><path d="M30 52 L44 65 L71 37" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={check} /></svg>
              <div style={{ fontSize: 40, fontWeight: 900, color: C.ink, marginTop: 20 }}>{s.ok}</div>
              <div style={{ background: '#fff', borderRadius: 22, padding: 24, marginTop: 26, fontSize: 28, fontWeight: 700, color: '#40524C', textAlign: 'left', border: '3px solid #E2EBE7', lineHeight: 1.6 }}>
                {[chosen, `${l.tomorrow}, ${s.time}`, l.emailSent].map((x, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: C.g, flexShrink: 0 }} />{x}</div>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 3: üstünlüklər ---------- */
const Cards = ({ s }) => {
  const icons = (s.icons || ['cal', 'mail', 'star']).map(k => Ic[k] || Ic.cal);
  const gold = i => (s.icons || [])[i] === 'star' || (!s.icons && i === 2);
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={260} size={96} />
      {s.items.map((x, i) => {
        const p = useSpring(24 + i * 26);
        return (
          <div key={i} style={{ position: 'absolute', left: 90, right: 90, top: 560 + i * 230, height: 190, borderRadius: 40, background: 'rgba(255,255,255,.96)', display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px', opacity: p, transform: `translateX(${(1 - p) * (i % 2 ? -400 : 400)}px)`, boxShadow: '0 24px 50px rgba(0,0,0,.25)' }}>
            <div style={{ width: 110, height: 110, borderRadius: 30, background: gold(i) ? '#FFF4DC' : '#E3F4EE', padding: 26, flexShrink: 0 }}>{icons[i](gold(i) ? C.gold : C.g)}</div>
            <div style={{ fontSize: fit(x, 46, 26), fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{x}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- sual: böyük sual, nəbz kimi döyünən işarə ---------- */
const Question = ({ s }) => {
  const f = useCurrentFrame();
  const q = useSpring(16, { damping: 10 }), ring = (f % 45) / 45;
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={260} size={92} />
      <div style={{ position: 'absolute', top: 760, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 300, height: 300 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `6px solid ${C.mint}`, opacity: (1 - ring) * q, transform: `scale(${1 + ring * 0.5})` }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 210, fontWeight: 900, color: C.deep, transform: `scale(${q}) rotate(${(1 - q) * -40}deg)` }}>?</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- əvvəl / sonra: iki kart, ikincisi sonra gəlir ---------- */
const BeforeAfter = ({ s, l }) => {
  const { durationInFrames } = useVideoConfig();
  const a = useSpring(14), b = useSpring(Math.round(durationInFrames * 0.42));
  const box = (label, list, good, p) => (
    <div style={{ background: good ? 'rgba(255,255,255,.97)' : 'rgba(255,255,255,.12)', border: good ? 'none' : '3px solid rgba(255,90,95,.6)', borderRadius: 36, padding: '28px 36px', opacity: p, transform: `translateY(${(1 - p) * 60}px)`, boxShadow: good ? '0 24px 50px rgba(0,0,0,.25)' : 'none' }}>
      <div style={{ fontSize: 34, fontWeight: 900, color: good ? C.g : '#FF8A8E', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      {list.map((x, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: fit(x, 40, 26), fontWeight: 800, color: good ? C.ink : '#fff', margin: '12px 0', lineHeight: 1.15 }}>
          <span style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0, background: good ? C.g : C.red, color: '#fff', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{good ? '✓' : '✕'}</span>{x}
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={170} size={80} />
      <div style={{ position: 'absolute', top: 500, left: 80, right: 80, display: 'flex', flexDirection: 'column', gap: 34 }}>
        {box(l.before, s.items.slice(0, 3), false, a)}
        {box(l.after, s.items.slice(3, 6), true, b)}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- biznes paneli: bu günün rezervləri, biri "Gəldi" olur ---------- */
const Panel = ({ s, l }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const enter = interpolate(f, [12, 34], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const flip = Math.round(durationInFrames * 0.55);
  const rows = s.items.slice(0, 3).map(x => { const [name, svc, time] = String(x).split('·').map(v => v.trim()); return { name: name || '', svc: svc || '', time: time || '' }; });
  const ps = [useSpring(30), useSpring(44), useSpring(58)];
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={190} size={80} />
      <div style={{ position: 'absolute', top: 540, left: 70, right: 70, background: C.paper, borderRadius: 40, overflow: 'hidden', opacity: enter, transform: `translateY(${(1 - enter) * 120}px)`, boxShadow: '0 40px 90px rgba(0,0,0,.45)' }}>
        <div style={{ background: C.g, color: '#fff', padding: '30px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: 24, fontWeight: 700, opacity: 0.75 }}>RezEt · Panel</div><div style={{ fontSize: fit(s.biz, 38, 20), fontWeight: 900, marginTop: 4 }}>{s.biz}</div></div>
          <div style={{ background: 'rgba(255,255,255,.16)', borderRadius: 999, padding: '10px 22px', fontSize: 26, fontWeight: 800 }}>{l.today}</div>
        </div>
        <div style={{ padding: '18px 26px 26px' }}>
          {rows.map((r, i) => {
            const p = ps[i], came = i === 0 && f > flip;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 24, padding: '22px 24px', marginTop: 14, border: '3px solid #E2EBE7', opacity: p, transform: `translateX(${(1 - p) * 120}px)` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.g, width: 96 }}>{r.time}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: fit(r.name, 32, 16), fontWeight: 900, color: C.ink }}>{r.name}</div><div style={{ fontSize: fit(r.svc, 26, 20), color: '#6B7C76', fontWeight: 600 }}>{r.svc}</div></div>
                <div style={{ borderRadius: 999, padding: '10px 18px', fontSize: 24, fontWeight: 800, background: came ? C.g : '#E3F4EE', color: came ? '#fff' : C.g, transform: came ? `scale(${1 + 0.12 * Math.max(0, 1 - (f - flip) / 8)})` : undefined }}>{came ? l.came : l.confirmed}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 3 məsləhət: nömrəli kartlar ---------- */
const Tips = ({ s }) => {
  const ps = [useSpring(22), useSpring(52), useSpring(82)];
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={200} size={84} />
      {s.items.slice(0, 3).map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: 80, right: 80, top: 520 + i * 250, minHeight: 200, borderRadius: 40, background: 'rgba(255,255,255,.96)', display: 'flex', alignItems: 'center', gap: 32, padding: '24px 40px', opacity: ps[i], transform: `translateY(${(1 - ps[i]) * 80}px)`, boxShadow: '0 24px 50px rgba(0,0,0,.25)' }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: C.g, color: '#fff', fontSize: 52, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
          <div style={{ fontSize: fit(x, 42, 30), fontWeight: 800, color: C.ink, lineHeight: 1.18 }}>{x}</div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/* ---------- müştəri rəyi: ulduzlar bir-bir dolur ---------- */
const Review = ({ s, l }) => {
  const f = useCurrentFrame();
  const card = useSpring(12, { damping: 16 });
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={220} size={84} />
      <div style={{ position: 'absolute', top: 620, left: 80, right: 80, background: 'rgba(255,255,255,.97)', borderRadius: 44, padding: '46px 48px', opacity: card, transform: `scale(${0.9 + card * 0.1})`, boxShadow: '0 30px 70px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2, 3, 4].map(i => { const on = interpolate(f, [28 + i * 6, 34 + i * 6], [0, 1], clamp); return <div key={i} style={{ width: 70, height: 70, transform: `scale(${0.6 + on * 0.4})` }}>{Ic.star(on > 0.5 ? C.gold : '#D5DDDA')}</div>; })}
        </div>
        <div style={{ fontSize: fit(s.items[1], 46, 70), fontWeight: 800, color: C.ink, lineHeight: 1.3, marginTop: 30, opacity: interpolate(f, [40, 56], [0, 1], clamp) }}>“{s.items[1]}”</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 30, opacity: interpolate(f, [52, 66], [0, 1], clamp) }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: C.g, color: '#fff', fontSize: 30, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String(s.items[0] || '?')[0]}</div>
          <div><div style={{ fontSize: 32, fontWeight: 900, color: C.ink }}>{s.items[0]}</div><div style={{ fontSize: 24, fontWeight: 700, color: C.g }}>✓ {l.verified}</div></div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- söhbət: müştəri yazır, cavab gəlir (gec və ya dərhal) ---------- */
const Chat = ({ s }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const [ask, reply, late] = s.items;
  const t2 = Math.round(durationInFrames * 0.5);
  const p1 = useSpring(14), p2 = useSpring(t2), pl = useSpring(t2 - 20);
  const typing = f > 34 && f < t2 - 4;
  const bubble = (text, mine, p) => (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: 760, background: mine ? C.mint : '#fff', color: C.ink, fontSize: fit(text, 42, 44), fontWeight: 700, lineHeight: 1.3, padding: '26px 32px', borderRadius: 34, borderBottomRightRadius: mine ? 8 : 34, borderBottomLeftRadius: mine ? 34 : 8, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.92 + p * 0.08})`, boxShadow: '0 16px 40px rgba(0,0,0,.25)' }}>{text}</div>
  );
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={190} size={80} />
      <div style={{ position: 'absolute', top: 520, left: 80, right: 80, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {bubble(ask, false, p1)}
        {late && <div style={{ alignSelf: 'center', color: 'rgba(255,255,255,.75)', fontSize: 30, fontWeight: 700, opacity: pl }}>{late}</div>}
        {typing ? <div style={{ alignSelf: 'flex-end', background: 'rgba(255,255,255,.18)', borderRadius: 30, padding: '22px 30px', display: 'flex', gap: 10 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', opacity: 0.35 + 0.65 * Math.abs(Math.sin(f / 6 + i)) }} />)}</div> : bubble(reply, true, p2)}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- POV: böyük, cəsarətli bir cümlə ---------- */
const Pov = ({ s }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const words = s.title.split(' ');
  const tag = spring({ frame: f - 4, fps, config: { damping: 12 } });
  const zoom = interpolate(f, [0, 120], [1.05, 1], clamp);
  return (
    <AbsoluteFill style={{}}>
      <div style={{ position: 'absolute', top: 520, left: 90, right: 90, transform: `scale(${zoom})`, transformOrigin: 'left center' }}>
        <div style={{ display: 'inline-block', background: C.mint, color: C.deep, fontWeight: 900, fontSize: 42, padding: '10px 24px', borderRadius: 14, marginBottom: 34, transform: `scale(${tag})` }}>POV</div>
        <div style={{ fontSize: fit(s.title, 94, 32), fontWeight: 900, lineHeight: 1.1, color: '#fff', letterSpacing: '-0.02em' }}>
          {words.map((w, i) => { const p = spring({ frame: f - 12 - i * 4, fps, config: { damping: 14 } }); return <span key={i} style={{ display: 'inline-block', marginRight: '0.25em', opacity: p, transform: `translateY(${(1 - p) * 60}px)`, color: i >= words.length - 2 ? C.mint : undefined }}>{w}</span>; })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- telefon bildirişləri: kilid ekranında RezEt bildirişləri ---------- */
const Notifs = ({ s, l }) => {
  const f = useCurrentFrame();
  const enter = interpolate(f, [12, 34], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const ps = [useSpring(40), useSpring(66), useSpring(92)];
  const W = 600, H = 1000;
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={170} size={76} />
      <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 380, width: W, height: H, opacity: enter, transform: `translateY(${(1 - enter) * 140}px)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 74, background: '#0B1512', boxShadow: '0 40px 90px rgba(0,0,0,.5), inset 0 0 0 3px #2A3A35' }} />
        <div style={{ position: 'absolute', inset: 16, borderRadius: 60, overflow: 'hidden', background: 'linear-gradient(180deg, #2A6B5A 0%, #0B2E25 100%)' }}>
          <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: '#0B1512' }} />
          <div style={{ textAlign: 'center', color: '#fff', marginTop: 110 }}>
            <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.85 }}>{s.weekday}</div>
            <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{s.bookedAt}</div>
          </div>
          <div style={{ position: 'absolute', top: 360, left: 22, right: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {s.items.slice(0, 3).map((x, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,.92)', borderRadius: 28, padding: '20px 22px', display: 'flex', gap: 16, alignItems: 'flex-start', opacity: ps[i], transform: `translateY(${(1 - ps[i]) * -40}px) scale(${0.94 + ps[i] * 0.06})`, boxShadow: '0 10px 24px rgba(0,0,0,.2)' }}>
                <Img src={staticFile('logo.svg')} style={{ width: 58, height: 58, borderRadius: 14, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: '#40524C' }}><span>RezEt</span><span>{l.ago[i]}</span></div>
                  <div style={{ fontSize: fit(x, 28, 34), fontWeight: 700, color: C.ink, lineHeight: 1.25, marginTop: 4 }}>{x}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- təqvim: həftə rezervlərlə dolur ---------- */
const Calendar = ({ s, l }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const enter = interpolate(f, [12, 34], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  const order = Array.from({ length: 42 }, (_, i) => ({ i, k: (i * 37 + 11) % 42 })).sort((a, b) => a.k - b.k).slice(0, 32);
  const rank = new Map(order.map((o, r) => [o.i, r]));
  const span = durationInFrames * 0.55;
  const colors = [C.mint, '#9BE8C6', C.g, '#F5B83D'];
  return (
    <AbsoluteFill style={{}}>
      <Title text={s.title} top={190} size={80} />
      <div style={{ position: 'absolute', top: 480, left: 70, right: 70, background: C.paper, borderRadius: 40, overflow: 'hidden', opacity: enter, transform: `translateY(${(1 - enter) * 120}px)`, boxShadow: '0 40px 90px rgba(0,0,0,.45)' }}>
        <div style={{ background: C.g, color: '#fff', padding: '26px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: fit(s.biz, 36, 20), fontWeight: 900 }}>{s.biz}</div>
          <div style={{ background: 'rgba(255,255,255,.16)', borderRadius: 999, padding: '8px 20px', fontSize: 24, fontWeight: 800 }}>{l.week}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, padding: '18px 22px 26px' }}>
          {l.days.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: '#6B7C76' }}>{d}</div>)}
          {Array.from({ length: 42 }, (_, i) => {
            const r = rank.get(i);
            const on = r !== undefined ? interpolate(f, [30 + (r * span) / 32, 38 + (r * span) / 32], [0, 1], clamp) : 0;
            return <div key={i} style={{ height: 78, borderRadius: 14, background: '#E2EBE7', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: colors[i % colors.length], opacity: on, transform: `scale(${0.6 + on * 0.4})`, borderRadius: 14 }} />
            </div>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 4: çağırış ---------- */
const Cta = ({ s, url }) => {
  const f = useCurrentFrame();
  const logo = useSpring(4, { damping: 11 }), name = useSpring(14), sub = useSpring(22), btn = useSpring(32, { damping: 10 });
  const shine = interpolate((f - 40) % 50, [0, 30], [-120, 520], clamp);
  // Sonluğun 3 fərqli quruluşu var, hər gün biri seçilir
  if (S.cta === 'stack') return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 560, left: 90, right: 90 }}>
        <Img src={staticFile('logo.svg')} style={{ width: 150, height: 150, borderRadius: 34, transform: `scale(${logo})`, transformOrigin: 'left center' }} />
        <div style={{ fontSize: 210, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1, marginTop: 30, opacity: name, transform: `translateX(${(1 - name) * -120}px)` }}>Rez<span style={{ color: C.mint }}>Et</span></div>
        <div style={{ width: `${sub * 100}%`, height: 10, background: C.mint, borderRadius: 5, margin: '30px 0' }} />
        <div style={{ fontSize: 56, fontWeight: 800, color: '#fff', lineHeight: 1.15, opacity: sub }}>{s.sub}</div>
        <div style={{ display: 'inline-block', marginTop: 46, background: '#fff', color: C.ink, fontSize: 52, fontWeight: 900, padding: '26px 56px', borderRadius: 18, transform: `scale(${btn})`, transformOrigin: 'left center' }}>{s.button} →</div>
      </div>
    </AbsoluteFill>
  );
  if (S.cta === 'stamp') {
    const ring = (f % 40) / 40;
    return (
      <AbsoluteFill style={{ alignItems: 'center' }}>
        <div style={{ position: 'absolute', top: 360, width: 460, height: 460, borderRadius: '50%', border: `8px solid ${C.mint}`, opacity: (1 - ring) * logo, transform: `scale(${0.8 + ring * 0.5})` }} />
        <div style={{ position: 'absolute', top: 400, width: 380, height: 380, borderRadius: '50%', background: C.mint, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${logo}) rotate(${(1 - logo) * 180}deg)` }}>
          <Img src={staticFile('logo.svg')} style={{ width: 230, height: 230, borderRadius: 50 }} />
        </div>
        <div style={{ position: 'absolute', top: 860, fontSize: 150, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', opacity: name, transform: `scale(${0.7 + name * 0.3})` }}>Rez<span style={{ color: C.mint }}>Et</span></div>
        <div style={{ position: 'absolute', top: 1060, left: 100, right: 100, textAlign: 'center', fontSize: 50, fontWeight: 700, color: 'rgba(255,255,255,.9)', opacity: sub }}>{s.sub}</div>
        <div style={{ position: 'absolute', top: 1240, border: `5px solid ${C.mint}`, color: C.mint, fontSize: 54, fontWeight: 900, padding: '24px 64px', borderRadius: 999, transform: `scale(${btn})` }}>{s.button}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <Img src={staticFile('logo.svg')} style={{ position: 'absolute', top: 420, width: 280, height: 280, transform: `scale(${logo}) rotate(${(1 - logo) * -30}deg)`, filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.4))', borderRadius: 60, outline: '6px solid rgba(255,255,255,.9)' }} />
      <div style={{ position: 'absolute', top: 760, fontSize: 170, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', opacity: name, transform: `translateY(${(1 - name) * 40}px)` }}>Rez<span style={{ color: C.mint }}>Et</span></div>
      <div style={{ position: 'absolute', top: 975, fontSize: 52, fontWeight: 700, color: 'rgba(255,255,255,.85)', opacity: sub }}>{s.sub}</div>
      <div style={{ position: 'absolute', top: 1110, overflow: 'hidden', borderRadius: 999, transform: `scale(${btn})`, boxShadow: `0 20px 50px ${C.mint}55` }}>
        <div style={{ background: C.mint, color: C.deep, fontSize: 56, fontWeight: 900, padding: '30px 70px' }}>{s.button}</div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: shine, width: 90, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)', transform: 'skewX(-20deg)' }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- viktorina: A və ya B? vaxt bitir, düzgün cavab açılır ---------- */
const Quiz = ({ s }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const reveal = Math.round(durationInFrames * 0.55), shown = f > reveal;
  const pa = useSpring(26), pb = useSpring(36);
  const timer = interpolate(f, [40, reveal], [1, 0], clamp);
  const opt = (label, text, p, good) => {
    const win = shown && good, lose = shown && !good;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 28, background: win ? C.mint : 'rgba(255,255,255,.96)', borderRadius: 36, padding: '34px 36px', opacity: p * (lose ? 0.5 : 1), transform: `translateX(${(1 - p) * (good ? 300 : -300)}px) scale(${win ? 1 + 0.05 * Math.max(0, 1 - (f - reveal) / 10) : 1})`, boxShadow: '0 24px 50px rgba(0,0,0,.3)' }}>
        <div style={{ width: 92, height: 92, borderRadius: 24, flexShrink: 0, background: win ? C.deep : C.ink, color: win ? C.mint : '#fff', fontSize: 50, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{shown ? (good ? '✓' : '✕') : label}</div>
        <div style={{ fontSize: fit(text, 44, 30), fontWeight: 800, color: win ? C.deep : C.ink, lineHeight: 1.15, textDecoration: lose ? 'line-through' : 'none' }}>{text}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Title text={s.title} top={210} size={84} />
      <div style={{ position: 'absolute', top: 640, left: 80, right: 80, display: 'flex', flexDirection: 'column', gap: 34 }}>
        {opt('A', s.items[0], pa, false)}
        {opt('B', s.items[1], pb, true)}
      </div>
      <div style={{ position: 'absolute', top: 1150, left: 80, right: 80, height: 14, borderRadius: 7, background: 'rgba(255,255,255,.2)', overflow: 'hidden', opacity: shown ? 0 : 1 }}><div style={{ width: `${timer * 100}%`, height: '100%', background: C.mint }} /></div>
    </AbsoluteFill>
  );
};

/* ---------- xəbər: "son dəqiqə" başlığı və aşağıda axan sətir ---------- */
const Headline = ({ s }) => {
  const f = useCurrentFrame();
  const tag = useSpring(6, { damping: 12 }), box = useSpring(16, { damping: 16 });
  const ticker = `${s.items[1] || ''}   •   `.repeat(6);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 430, left: 70, display: 'flex', alignItems: 'center', gap: 18, transform: `scale(${tag})`, transformOrigin: 'left center' }}>
        <div style={{ background: C.red, color: '#fff', fontSize: 40, fontWeight: 900, padding: '12px 26px', borderRadius: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.items[0]}</div>
        <div style={{ width: 22, height: 22, borderRadius: 11, background: C.red, opacity: f % 30 < 15 ? 1 : 0.25 }} />
      </div>
      <div style={{ position: 'absolute', top: 540, left: 70, right: 70, background: '#fff', borderLeft: `18px solid ${C.mint}`, padding: '34px 40px', transform: `translateX(${(1 - box) * -1000}px)`, boxShadow: '0 30px 70px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize: fit(s.title, 74, 40), fontWeight: 900, color: C.ink, lineHeight: 1.1, textWrap: 'balance', textTransform: S.upper ? 'uppercase' : undefined }}>{s.title}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 470, left: 0, right: 0, height: 92, background: C.mint, overflow: 'hidden', display: 'flex', alignItems: 'center', opacity: interpolate(f, [26, 36], [0, 1], clamp) }}>
        <div style={{ whiteSpace: 'nowrap', fontSize: 40, fontWeight: 800, color: C.deep, transform: `translateX(${1080 - f * 7}px)` }}>{ticker}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- geri sayım: 3, 2, 1 — hər rəqəmlə bir fikir ---------- */
const Countdown = ({ s }) => {
  const f = useCurrentFrame(), { durationInFrames, fps } = useVideoConfig();
  const seg = (durationInFrames - 20) / 3, i = Math.min(2, Math.max(0, Math.floor((f - 10) / seg))), local = f - 10 - i * seg;
  const p = spring({ frame: local, fps, config: { damping: 9 } });
  const text = s.items[i] || '';
  return (
    <AbsoluteFill>
      <Title text={s.title} top={200} size={70} />
      <div style={{ position: 'absolute', top: 500, left: 0, right: 0, textAlign: 'center', fontSize: 500, fontWeight: 900, color: C.mint, lineHeight: 1, opacity: Math.min(1, p * 1.4), transform: `scale(${0.4 + p * 0.6}) rotate(${(1 - p) * -12}deg)` }}>{3 - i}</div>
      <div style={{ position: 'absolute', top: 1060, left: 90, right: 90, textAlign: 'center', fontSize: fit(text, 56, 30), fontWeight: 800, color: '#fff', lineHeight: 1.2, opacity: interpolate(local, [6, 14], [0, 1], clamp), transform: `translateY(${interpolate(local, [6, 14], [30, 0], clamp)}px)` }}>{text}</div>
    </AbsoluteFill>
  );
};

/* ---------- mesaj seli: ekran müştəri mesajları ilə dolur, sonra hamısı uçub gedir ---------- */
const Flood = ({ s }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const out = Math.round(durationInFrames * 0.7);
  const leave = interpolate(f, [out, out + 14], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const pos = [[70, 500, -3], [400, 630, 2], [110, 770, 4], [380, 910, -2], [80, 1050, 1], [390, 1190, -4]];
  return (
    <AbsoluteFill>
      <Title text={s.title} top={190} size={80} />
      {s.items.slice(0, 6).map((m, i) => {
        const p = interpolate(f, [18 + i * 9, 26 + i * 9], [0, 1], clamp), [x, y, rot] = pos[i];
        return <div key={i} style={{ position: 'absolute', left: x, top: y, maxWidth: 610, background: '#fff', color: C.ink, borderRadius: 30, borderBottomLeftRadius: 8, padding: '22px 28px', fontSize: fit(m, 36, 30), fontWeight: 700, lineHeight: 1.25, boxShadow: '0 14px 34px rgba(0,0,0,.3)', opacity: p * (1 - leave), transform: `translate(${leave * (i % 2 ? 1000 : -1000)}px, ${(1 - p) * 40}px) rotate(${rot}deg) scale(${0.85 + p * 0.15})` }}>{m}</div>;
      })}
    </AbsoluteFill>
  );
};

/* ---------- bölünmüş ekran: yuxarıda xaos, aşağıda RezEt ilə sakitlik ---------- */
const Split = ({ s }) => {
  const f = useCurrentFrame();
  const a = useSpring(10), b = useSpring(40);
  const half = (label, text, good, p, top) => (
    <div style={{ position: 'absolute', left: 0, right: 0, top, height: 500, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 90px', background: good ? `${C.mint}26` : 'rgba(255,90,95,.16)', opacity: p }}>
      <div style={{ alignSelf: 'flex-start', fontSize: 34, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: good ? C.deep : '#fff', background: good ? C.mint : C.red, padding: '8px 22px', borderRadius: 10 }}>{label}</div>
      <div style={{ marginTop: 26, fontSize: fit(text, 58, 34), fontWeight: 900, color: '#fff', lineHeight: 1.12, transform: good ? `translateY(${(1 - p) * 40}px)` : `translateX(${Math.sin(f * 1.7) * 5 * (1 - b)}px)` }}>{text}</div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Title text={s.title} top={150} size={70} />
      {half(s.items[0], s.items[2], false, a, 400)}
      {half(s.items[1], s.items[3], true, b, 920)}
      <div style={{ position: 'absolute', top: 908, left: 0, height: 8, width: `${b * 100}%`, background: C.mint }} />
    </AbsoluteFill>
  );
};

/* ---------- siyahı: böyük konturlu rəqəmlər, səhvlərin üstündən xətt çəkilir ---------- */
const List = ({ s }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  const gap = (durationInFrames * 0.6) / 3;
  return (
    <AbsoluteFill>
      <Title text={s.title} top={200} size={80} />
      {s.items.slice(0, 3).map((x, i) => {
        const t0 = 24 + i * gap, p = interpolate(f, [t0, t0 + 10], [0, 1], clamp), strike = interpolate(f, [t0 + gap * 0.55, t0 + gap * 0.55 + 10], [0, 1], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left: 80, right: 80, top: 560 + i * 270, display: 'flex', alignItems: 'center', gap: 36, opacity: p, transform: `translateX(${(1 - p) * -120}px)` }}>
            <div style={{ fontSize: 170, fontWeight: 900, lineHeight: 1, color: 'transparent', WebkitTextStroke: `5px ${C.mint}`, width: 230, flexShrink: 0 }}>0{i + 1}</div>
            <div style={{ position: 'relative', fontSize: fit(x, 50, 30), fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>{x}<div style={{ position: 'absolute', left: 0, top: '52%', height: 8, borderRadius: 4, width: `${strike * 100}%`, background: C.red }} /></div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- altyazı-hook: sosial şəbəkə üslubunda söz-söz çıxan böyük mətn ---------- */
const Caption = ({ s }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const words = String(s.title || '').split(' ');
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 640, left: 70, right: 70, textAlign: 'center' }}>
        {words.map((w, i) => {
          const p = spring({ frame: f - 8 - i * 5, fps, config: { damping: 12 } }), hi = i % 3 === 1;
          return <span key={i} style={{ display: 'inline-block', margin: '0 8px 16px', padding: '6px 18px', background: hi ? C.mint : '#fff', color: hi ? C.deep : C.ink, fontSize: fit(s.title, 76, 30), fontWeight: 900, borderRadius: 12, textTransform: S.upper ? 'uppercase' : undefined, opacity: p, transform: `scale(${p}) rotate(${(i % 2 ? 1 : -1) * (1 - p) * 8}deg)` }}>{w}</span>;
        })}
      </div>
    </AbsoluteFill>
  );
};

export const L = {
  az: { missed: 'Buraxılmış zəng', choose: 'Xidmət seçin', chooseTime: 'Vaxt seçin · Sabah', confirm: 'Təsdiqlə', tomorrow: 'Sabah', emailSent: 'Təsdiq e-poçta göndərildi', cur: 'AZN', before: 'Əvvəl', after: 'RezEt ilə', today: 'Bu gün', confirmed: 'Təsdiq', came: 'Gəldi', verified: 'Təsdiqlənmiş müştəri', caller: 'Yeni müştəri', ago: ['indi', '5 dəq əvvəl', '12 dəq əvvəl'], week: 'Bu həftə', days: ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'] },
  en: { missed: 'Missed call', choose: 'Choose a service', chooseTime: 'Pick a time · Tomorrow', confirm: 'Confirm', tomorrow: 'Tomorrow', emailSent: 'Confirmation sent by email', cur: 'AZN', before: 'Before', after: 'With RezEt', today: 'Today', confirmed: 'Confirmed', came: 'Arrived', verified: 'Verified customer', caller: 'New client', ago: ['now', '5 min ago', '12 min ago'], week: 'This week', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
};
const SCENES = { calls: Calls, question: Question, phone: Phone, cards: Cards, beforeAfter: BeforeAfter, panel: Panel, tips: Tips, review: Review, chat: Chat, pov: Pov, notifications: Notifs, calendar: Calendar, quiz: Quiz, headline: Headline, countdown: Countdown, flood: Flood, split: Split, list: List, caption: Caption, cta: Cta };
// Səhnəyə görə alt yazının nə vaxt çıxacağı (səhnənin öz animasiyası bitəndən sonra)
const LINE_DELAY = { tips: 70, beforeAfter: 70, chat: 90, pov: 60, quiz: 100, countdown: 40, flood: 80, list: 90, split: 70, caption: 70 };

const TRANS = {
  slide: i => slide({ direction: i % 2 ? 'from-left' : 'from-right' }),
  wipe: i => wipe({ direction: i % 2 ? 'from-bottom-left' : 'from-top-right' }),
  flip: i => flip({ direction: i % 2 ? 'from-left' : 'from-right' }),
  clock: () => clockWipe({ width: 1080, height: 1920 }),
  iris: () => iris({ width: 1080, height: 1920 }),
  push: () => pushCut({ flashColor: P.accent }),
  fade: () => fade()
};

export const Promo = ({ scenes, url, music, lang, theme, style = {} }) => {
  // Günün üslubu (render zamanı bir dəfə təyin olunur, bütün səhnələr istifadə edir)
  Object.assign(P, PALETTES[style.palette] || PALETTES[theme] || PALETTES.forest);
  Object.assign(C, { mint: P.accent, deep: P.on });
  const font = FONTS[style.font] || FONTS.inter;
  Object.assign(S, { look: style.look || 'glow', anim: style.anim || 'rise', cta: style.cta || 'center', trans: style.trans || 'slide', size: font.size, upper: !!font.upper });
  const tr = TRANS[S.trans] || TRANS.slide;
  return (
    // lang="az": böyük hərfə çevirəndə "i" düzgün "İ" olur
    <AbsoluteFill lang={lang === 'en' ? 'en' : 'az'} style={{ background: P.b, fontFamily: font.family }}>
      <Bg />
      {music && <Audio src={staticFile(music)} />}
      <TransitionSeries>
        {scenes.flatMap((s, i) => {
          const Sc = SCENES[s.type];
          const out = [
            <TransitionSeries.Sequence key={'s' + i} durationInFrames={sceneFrames(s)}>
              {S.look === 'footage' && s.clip && <Footage src={s.clip} frames={s.clipFrames} />}
              <Sequence from={i ? T : 0} durationInFrames={sceneFrames(s) - (i ? T : 0)} layout="none">
                <Sc s={s} url={url} l={L[lang] || L.az} />
                <Subs words={s.words} />
                {s.line && !s.words?.length && <Line text={s.line} delay={LINE_DELAY[s.type] || 34} />}
              </Sequence>
              {s.audio && <Audio src={staticFile(s.audio)} />}
            </TransitionSeries.Sequence>
          ];
          if (i < scenes.length - 1) out.push(<TransitionSeries.Transition key={'t' + i} presentation={tr(i)} timing={linearTiming({ durationInFrames: T, easing: Easing.inOut(Easing.cubic) })} />);
          return out;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
