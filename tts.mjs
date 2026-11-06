// Səsləndirmə: ssenaridəki hər səhnənin mətnini səsə çevirir, söz vaxtlarını (altyazı üçün) saxlayır
// İstifadə: node tts.mjs script.json props.json
import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const [, , inFile = 'script.json', outFile = 'props.json'] = process.argv;
const script = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const voiceDir = path.join('public', 'voice', script.id);
fs.mkdirSync(voiceDir, { recursive: true });

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tts = new MsEdgeTTS();
await tts.setMetadata(script.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });

for (const [i, s] of script.scenes.entries()) {
  const dir = path.join(voiceDir, String(i));
  fs.mkdirSync(dir, { recursive: true });
  const { audioFilePath, metadataFilePath } = await tts.toFile(dir, esc(s.say), { rate: script.rate || '+0%' });
  // 48 kbit/s sabit sürət: müddət = bayt * 8 / 48000
  s.audio = path.relative('public', audioFilePath).split(path.sep).join('/');
  s.seconds = fs.statSync(audioFilePath).size * 8 / 48000;
  s.words = [];
  if (metadataFilePath && fs.existsSync(metadataFilePath)) {
    const meta = JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));
    for (const m of meta.Metadata || meta) {
      const d = m.Data || m;
      if ((m.Type || d.Type) === 'WordBoundary' || d.text) s.words.push({ t: (d.Offset || 0) / 1e7, d: (d.Duration || 0) / 1e7, w: d.text?.Text ?? d.text ?? '' });
    }
  }
  // Altyazı sətirləri cümlə sonunda bölünsün: sözdən sonra durğu işarəsi varsa qeyd edilir
  let pos = 0;
  for (const w of s.words) { const k = s.say.indexOf(w.w, pos); if (k >= 0) { pos = k + w.w.length; w.p = /^[.,!?;:…—]/.test(s.say.slice(pos).trimStart()) || /[.,!?]$/.test(w.w); } }
  console.log(i, s.seconds.toFixed(2) + 's', s.words.length, 'words');
}
tts.close();
fs.writeFileSync(outFile, JSON.stringify(script, null, 2));
