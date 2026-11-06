import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['500', '700', '800', '900'], subsets: ['latin', 'latin-ext'] });

export const FPS = 30;
export const T = 18; // keçid uzunluğu (kadr)
const C = { g: '#0D5E4A', deep: '#062A21', mint: '#3DDC97', gold: '#F5B83D', red: '#FF5A5F', ink: '#10231D', paper: '#F4F8F6' };
export const sceneFrames = s => s.frames || Math.ceil((s.seconds + 0.7) * FPS) + T;
export const totalFrames = scenes => scenes.reduce((n, s) => n + sceneFrames(s), 0) - T * (scenes.length - 1);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const useSpring = (delay = 0, config = { damping: 14, mass: 0.7 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config });
};

/* ---------- fon: tünd yaşıl, yavaş hərəkət edən işıq ləkələri ---------- */
const Bg = () => {
  const f = useCurrentFrame();
  const blob = (x, y, r, c, sp, ph) => (
    <div style={{ position: 'absolute', left: x + Math.sin(f / sp + ph) * 120, top: y + Math.cos(f / (sp * 1.3) + ph) * 140, width: r, height: r, borderRadius: '50%', background: c, filter: 'blur(120px)', opacity: 0.55 }} />
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(165deg, #0B4D3D 0%, ${C.deep} 70%)`, overflow: 'hidden' }}>
      {blob(-200, 100, 700, '#1E8F6E', 70, 0)}
      {blob(500, 1100, 800, '#0F6B53', 90, 2)}
      {blob(300, 600, 500, '#3DDC9740', 60, 4)}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.06) 2px, transparent 2px)', backgroundSize: '44px 44px' }} />
    </AbsoluteFill>
  );
};

/* ---------- başlıq: sözlər bir-bir yuxarı qalxır ---------- */
const Title = ({ text, top = 200, size = 82, delay = 4 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', top, left: 70, right: 70, textAlign: 'center', fontSize: size, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.02em', color: '#fff' }}>
      {text.split(' ').map((w, i) => {
        const p = spring({ frame: f - delay - i * 5, fps, config: { damping: 15, mass: 0.8 } });
        return <span key={i} style={{ display: 'inline-block', marginRight: '0.25em', opacity: p, transform: `translateY(${(1 - p) * 50}px)`, color: w === '—' ? C.mint : undefined }}>{w}</span>;
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
      <div style={{ background: 'rgba(3,20,15,.62)', borderRadius: 26, padding: '20px 34px', fontSize: 48, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.25, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>{text}</div>
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
    <AbsoluteFill style={{ fontFamily }}>
      <Title text={s.title} top={190} />
      <div style={{ position: 'absolute', top: 560, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 190, height: 190, borderRadius: '50%', background: C.red, padding: 46, transform: `scale(${ic}) rotate(${ring}deg)`, boxShadow: `0 0 0 ${20 + Math.sin(f / 4) * 10}px ${C.red}33` }}>{Ic.phone('#fff')}</div>
      </div>
      {[0, 1, 2].map(i => {
        const p = useSpring(45 + i * 28);
        return (
          <div key={i} style={{ position: 'absolute', left: 110, right: 110, top: 840 + i * 150, height: 124, borderRadius: 30, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', gap: 26, padding: '0 32px', opacity: p, transform: `translateX(${(1 - p) * 300}px) scale(${0.9 + p * 0.1})`, boxShadow: '0 20px 40px rgba(0,0,0,.25)' }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: '#FFE8E9', padding: 15 }}>{Ic.phone(C.red)}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 36, fontWeight: 800, color: C.ink }}>{l.missed}</div><div style={{ fontSize: 28, color: '#6B7C76', fontWeight: 500 }}>+994 5• ••• •• {['14', '72', '38'][i]}</div></div>
            <div style={{ fontSize: 30, color: '#6B7C76', fontWeight: 700 }}>{['10:02', '10:15', '10:31'][i]}</div>
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
    <AbsoluteFill style={{ fontFamily }}>
      <Title text={s.title} top={170} size={76} />
      <div style={{ position: 'absolute', left: (1080 - W) / 2, top: 380, width: W, height: H, opacity: enter, transform: `translateY(${(1 - enter) * 140 + float}px) scale(${0.94 + enter * 0.06})` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 74, background: '#0B1512', boxShadow: '0 40px 90px rgba(0,0,0,.5), inset 0 0 0 3px #2A3A35' }} />
        <div style={{ position: 'absolute', inset: 16, borderRadius: 60, background: C.paper, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 18, left: '50%', width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: '#0B1512', zIndex: 5 }} />
          <div style={{ background: C.g, color: '#fff', padding: '86px 34px 30px' }}>
            <div style={{ fontSize: 24, opacity: 0.75, fontWeight: 700 }}>RezEt</div>
            <div style={{ fontSize: 38, fontWeight: 900, marginTop: 6 }}>{s.biz}</div>
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
    <AbsoluteFill style={{ fontFamily }}>
      <Title text={s.title} top={260} size={96} />
      {s.items.map((x, i) => {
        const p = useSpring(24 + i * 26);
        return (
          <div key={i} style={{ position: 'absolute', left: 90, right: 90, top: 560 + i * 230, height: 190, borderRadius: 40, background: 'rgba(255,255,255,.96)', display: 'flex', alignItems: 'center', gap: 34, padding: '0 40px', opacity: p, transform: `translateX(${(1 - p) * (i % 2 ? -400 : 400)}px)`, boxShadow: '0 24px 50px rgba(0,0,0,.25)' }}>
            <div style={{ width: 110, height: 110, borderRadius: 30, background: gold(i) ? '#FFF4DC' : '#E3F4EE', padding: 26, flexShrink: 0 }}>{icons[i](gold(i) ? C.gold : C.g)}</div>
            <div style={{ fontSize: 46, fontWeight: 900, color: C.ink, lineHeight: 1.1 }}>{x}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ---------- 4: çağırış ---------- */
const Cta = ({ s, url }) => {
  const f = useCurrentFrame();
  const logo = useSpring(4, { damping: 11 }), name = useSpring(14), sub = useSpring(22), btn = useSpring(32, { damping: 10 });
  const shine = interpolate((f - 40) % 50, [0, 30], [-120, 520], clamp);
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: 'center' }}>
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

export const L = {
  az: { missed: 'Buraxılmış zəng', choose: 'Xidmət seçin', chooseTime: 'Vaxt seçin · Sabah', confirm: 'Təsdiqlə', tomorrow: 'Sabah', emailSent: 'Təsdiq e-poçta göndərildi', cur: 'AZN' },
  en: { missed: 'Missed call', choose: 'Choose a service', chooseTime: 'Pick a time · Tomorrow', confirm: 'Confirm', tomorrow: 'Tomorrow', emailSent: 'Confirmation sent by email', cur: 'AZN' }
};
const SCENES = { calls: Calls, phone: Phone, cards: Cards, cta: Cta };

export const Promo = ({ scenes, url, music, lang }) => (
  <AbsoluteFill style={{ fontFamily, background: C.deep }}>
    <Bg />
    {music && <Audio src={staticFile(music)} />}
    <TransitionSeries>
      {scenes.flatMap((s, i) => {
        const S = SCENES[s.type];
        const out = [
          <TransitionSeries.Sequence key={'s' + i} durationInFrames={sceneFrames(s)}>
            <Sequence from={i ? T : 0} durationInFrames={sceneFrames(s) - (i ? T : 0)} layout="none">
              <S s={s} url={url} l={L[lang] || L.az} />
              <Subs words={s.words} />
              {s.line && !s.words?.length && <Line text={s.line} />}
            </Sequence>
            {s.audio && <Audio src={staticFile(s.audio)} />}
          </TransitionSeries.Sequence>
        ];
        if (i < scenes.length - 1) out.push(<TransitionSeries.Transition key={'t' + i} presentation={i % 2 ? fade() : slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: T, easing: Easing.inOut(Easing.cubic) })} />);
        return out;
      })}
    </TransitionSeries>
  </AbsoluteFill>
);
