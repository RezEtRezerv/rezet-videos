import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['600', '800', '900'], subsets: ['latin', 'latin-ext'] });

// Facebook örtük şəkli: 1640×624. Telefonda kənarlar kəsilir, ona görə əsas mətn ortadadır.
export const FbCover = () => (
  <AbsoluteFill style={{ fontFamily, background: 'linear-gradient(120deg, #0B4D3D 0%, #062A21 75%)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', right: -120, top: -220, width: 700, height: 700, borderRadius: '50%', background: '#1E8F6E', filter: 'blur(140px)', opacity: 0.5 }} />
    <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 2px, transparent 2px)', backgroundSize: '32px 32px' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
      <Img src={staticFile('logo.svg')} style={{ width: 170, height: 170, borderRadius: 40, outline: '5px solid rgba(255,255,255,.85)' }} />
      <div>
        <div style={{ fontSize: 110, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>Rez<span style={{ color: '#3DDC97' }}>Et</span></div>
        <div style={{ fontSize: 40, fontWeight: 600, color: 'rgba(255,255,255,.88)', marginTop: 14 }}>Bizneslər üçün onlayn rezerv</div>
        <div style={{ display: 'flex', gap: 26, marginTop: 22 }}>
          {['7/24 onlayn rezerv', 'Avtomatik xatırlatma', 'Təsdiqlənmiş rəylər'].map(x => (
            <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 28, fontWeight: 800, color: '#fff' }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: '#3DDC97' }} />{x}
            </div>
          ))}
        </div>
      </div>
    </div>
  </AbsoluteFill>
);
