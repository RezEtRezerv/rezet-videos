import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['600', '800', '900'], subsets: ['latin', 'latin-ext'] });

// LinkedIn örtük şəkli: 1128×191. Sol tərəfdə profil şəkli üstünə düşdüyü üçün mətn sağdadır.
export const Cover = () => (
  <AbsoluteFill style={{ fontFamily, background: 'linear-gradient(120deg, #0B4D3D 0%, #062A21 75%)', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', right: -80, top: -140, width: 420, height: 420, borderRadius: '50%', background: '#1E8F6E', filter: 'blur(90px)', opacity: 0.5 }} />
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
    <div style={{ position: 'absolute', left: 230, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 26 }}>
      <Img src={staticFile('logo.svg')} style={{ width: 92, height: 92, borderRadius: 22, outline: '3px solid rgba(255,255,255,.85)' }} />
      <div>
        <div style={{ fontSize: 50, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>Rez<span style={{ color: '#3DDC97' }}>Et</span></div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginTop: 8 }}>Online booking platform for businesses</div>
      </div>
    </div>
    <div style={{ position: 'absolute', right: 36, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
      {['24/7 online booking', 'Email confirmations & reminders', 'Verified reviews'].map(x => (
        <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, color: '#fff' }}>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: '#3DDC97' }} />{x}
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
