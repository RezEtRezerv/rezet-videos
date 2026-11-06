// Ssenaridən video parametrləri hazırlayır: hər səhnənin uzunluğu musiqinin taktına bağlanır,
// sonra həmin uzunluqda fon musiqisi yaradılır.
// İstifadə: node prepare.mjs script.json props.json
import fs from 'node:fs';
import path from 'node:path';
import { makeMusic } from './music.mjs';

const FPS = 30, T = 18;
const [, , inFile = 'script.json', outFile = 'props.json'] = process.argv;
const script = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const bpm = script.bpm || 100, barFrames = (60 / bpm) * 4 * FPS;
let bars = 0;
for (const s of script.scenes) {
  s.frames = Math.round((s.bars || 3) * barFrames) + T; // keçid növbəti səhnə ilə üst-üstə düşür
  bars += s.bars || 3;
}
fs.mkdirSync(path.join('public', 'music'), { recursive: true });
const m = makeMusic({ seed: script.id, bpm, bars, file: path.join('public', 'music', `${script.id}.wav`) });
script.music = `music/${script.id}.wav`;
fs.writeFileSync(outFile, JSON.stringify(script, null, 2));
console.log(`${bars} takt, ${bpm} BPM, ton ${m.key}, ${m.seconds.toFixed(1)} s`);
