// Gündəlik video: Claude ssenari yazır, Remotion iki video hazırlayır (az + en),
// nəticə site/ qovluğuna yazılır (GitHub Pages ilə ictimai link olur).
// İstifadə: node daily.mjs            (ANTHROPIC_API_KEY lazımdır)
//           node daily.mjs --mock     (Claude-suz, yerli sınaq üçün nümunə ssenari)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { makeMusic } from './music.mjs';

const FPS = 30, T = 18, MOCK = process.argv.includes('--mock');
const SITE = 'site', BASE = (process.env.PAGES_URL || 'https://rezetrezerv.github.io/rezet-videos').replace(/\/$/, '');
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Bakı vaxtı ilə tarix
const HISTORY = 'history.json';
const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '15:30', '16:00'];
const ICONS = ['cal', 'mail', 'star', 'clock', 'chart', 'users'];

/* ---------- 1. Claude-dan ssenari ---------- */
const Lang = z.object({
  hook: z.string().describe('Scene 1 big title, max 42 characters'),
  hookLine: z.string().describe('Scene 1 bottom line, max 55 characters'),
  badge: z.string().describe('Short red badge in scene 1, e.g. "3 missed calls", max 22 characters'),
  phoneTitle: z.string().describe('Scene 2 title above the phone, max 40 characters'),
  phoneLine: z.string().describe('Scene 2 bottom line, max 50 characters'),
  services: z.array(z.object({ name: z.string().describe('max 20 characters'), price: z.number().int() })).describe('Exactly 3 services of this business with realistic AZN prices'),
  okText: z.string().describe('Confirmation text shown in the phone, e.g. "Booking confirmed", max 24 characters'),
  cardsTitle: z.string().describe('Scene 3 title, max 26 characters'),
  items: z.array(z.string()).describe('Exactly 3 short benefit lines of RezEt, each max 28 characters'),
  cardsLine: z.string().describe('Scene 3 bottom line, max 50 characters'),
  ctaSub: z.string().describe('Under the RezEt logo, max 34 characters'),
  ctaButton: z.string().describe('Button text, max 20 characters'),
  title: z.string().describe('YouTube title, max 80 characters, no hashtags'),
  caption: z.string().describe('Post caption: 2-3 sentences + hashtags, no links or URLs')
});
const Script = z.object({
  topic: z.string().describe('One-line topic of today in English'),
  sector: z.enum(['barber', 'beauty', 'clinic', 'restaurant', 'tour']),
  biz: z.string().describe('Invented business name shown in the phone, max 22 characters'),
  pick: z.number().int().describe('Index 0-2 of the service the customer picks'),
  time: z.enum(SLOTS),
  icons: z.array(z.enum(ICONS)).describe('Exactly 3 icons matching the 3 benefit items, in order'),
  az: Lang,
  en: Lang
});

const SYSTEM = `You write daily short vertical promo videos (Instagram Reels, YouTube Shorts, Facebook, LinkedIn) for RezEt, an online booking platform for businesses in Azerbaijan.
What RezEt does: customers book online 24/7 without calling; they get email confirmation and an email reminder 2 hours before; the business manages bookings, staff schedules, closed days and customers in one panel; verified customer reviews with stars; waitlist emails when a slot frees up; a free plan exists.
Each video has 4 scenes: (1) a problem hook with missed calls, (2) a phone showing a customer booking at a business, (3) three benefits, (4) the RezEt logo with a call to action.

Rules:
- Write the Azerbaijani version first (natural, correct Azerbaijani with ə, ğ, ı, ö, ü, ş, ç), then the English version for LinkedIn (natural professional English, not a literal translation).
- The business shown in the phone must have an invented name that does not exist: a coined word plus a type, like "Nərvix Barber Studio" or "Lumora Clinic". Never use real brands, real places' business names, or common generic names.
- Rotate sectors and angles day to day. Do not repeat a recent topic or business name.
- No website links, URLs, phone numbers, emails or social handles anywhere.
- No invented statistics, percentages, prices for RezEt, or promises RezEt cannot keep. No competitor names.
- Professional, calm, confident tone. Respect every length limit; shorter is better.
- Services and prices must fit the sector (for a restaurant: e.g. table for 2; for a tour: a day trip).`;

async function writeScript() {
  if (MOCK) return JSON.parse(fs.readFileSync('mock-script.json', 'utf8'));
  const client = new Anthropic();
  const recent = history.slice(-30).map(h => `${h.date}: ${h.sector} | ${h.topic} | ${h.biz}`).join('\n') || 'none yet';
  const res = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(Script) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Date: ${today}.\nRecent videos (avoid repeating these topics and names):\n${recent}\n\nWrite today's video.` }]
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude bu gün ssenari yazmaqdan imtina etdi');
  if (!res.parsed_output) throw new Error('Claude cavabı JSON kimi oxunmadı');
  return res.parsed_output;
}

/* ---------- 2. Yoxlama: limitlər, qadağalar ---------- */
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const NO_LINKS = /(https?:\/\/|www\.|\.(az|com|dev|net|org)\b|@\w)/i;
function check(sc) {
  const bad = [];
  if (!sc.biz || sc.biz.length > 26) bad.push('biz');
  if (!Number.isInteger(sc.pick) || sc.pick < 0 || sc.pick > 2) sc.pick = 1;
  if (!SLOTS.includes(sc.time)) sc.time = '10:30';
  sc.icons = (sc.icons || []).filter(i => ICONS.includes(i)).slice(0, 3);
  while (sc.icons.length < 3) sc.icons.push(['cal', 'mail', 'star'][sc.icons.length]);
  for (const k of ['az', 'en']) {
    const v = sc[k];
    if (!v || v.services?.length !== 3 || v.items?.length !== 3) { bad.push(k + ' lists'); continue; }
    const all = JSON.stringify(v);
    if (NO_LINKS.test(all)) bad.push(k + ' contains a link');
    v.services = v.services.map(s => ({ name: cut(s.name, 22), price: Math.min(999, Math.max(1, Math.round(+s.price || 10))) }));
    v.items = v.items.map(x => cut(x, 30));
    for (const [f, n] of [['hook', 46], ['hookLine', 60], ['badge', 24], ['phoneTitle', 44], ['phoneLine', 56], ['okText', 26], ['cardsTitle', 30], ['cardsLine', 56], ['ctaSub', 36], ['ctaButton', 22], ['title', 90]]) v[f] = cut(v[f], n);
    v.caption = String(v.caption || '').trim().slice(0, 2000);
  }
  if (bad.length) throw new Error('Ssenari yoxlamadan keçmədi: ' + bad.join(', '));
  return sc;
}

/* ---------- 3. Video ---------- */
function build(sc, lang, bpm, musicFile) {
  const v = sc[lang], barF = (60 / bpm) * 4 * FPS;
  const scenes = [
    { type: 'calls', bars: 3, title: v.hook, badge: v.badge, line: v.hookLine },
    { type: 'phone', bars: 4, title: v.phoneTitle, biz: sc.biz, services: v.services, pick: sc.pick, time: sc.time, ok: v.okText, line: v.phoneLine },
    { type: 'cards', bars: 3, title: v.cardsTitle, items: v.items, icons: sc.icons, line: v.cardsLine },
    { type: 'cta', bars: 3, title: 'RezEt', sub: v.ctaSub, button: v.ctaButton }
  ].map(s => ({ ...s, frames: Math.round(s.bars * barF) + T }));
  const props = { id: `${today}-${lang}`, lang, scenes, music: musicFile };
  const pf = `props-${lang}.json`;
  fs.writeFileSync(pf, JSON.stringify(props, null, 2));
  const out = path.join(SITE, `${today}-${lang}.mp4`);
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['remotion', 'render', 'src/index.jsx', 'Promo', out, `--props=${pf}`, '--crf=18', '--log=error'], { stdio: 'inherit', shell: process.platform === 'win32' });
  return out;
}

const sc = check(await writeScript());
console.log('Mövzu:', sc.topic, '|', sc.sector, '|', sc.biz);
fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });
fs.mkdirSync(path.join('public', 'music'), { recursive: true });
const bpm = 96 + (parseInt(today.replace(/-/g, ''), 10) % 11); // hər gün bir az fərqli temp
makeMusic({ seed: today, bpm, bars: 13, file: path.join('public', 'music', `${today}.wav`) });
for (const lang of ['az', 'en']) build(sc, lang, bpm, `music/${today}.wav`);

const entry = lang => ({ video: `${BASE}/${today}-${lang}.mp4`, title: sc[lang].title, caption: sc[lang].caption });
fs.writeFileSync(path.join(SITE, 'latest.json'), JSON.stringify({ date: today, topic: sc.topic, az: entry('az'), en: entry('en') }, null, 2));
fs.writeFileSync(path.join(SITE, 'index.html'), `<!doctype html><meta charset="utf-8"><title>RezEt videos</title><h1>${today}</h1><video src="${today}-az.mp4" controls width="360"></video><video src="${today}-en.mp4" controls width="360"></video>`);
history.push({ date: today, sector: sc.sector, topic: sc.topic, biz: sc.biz });
fs.writeFileSync(HISTORY, JSON.stringify(history.slice(-90), null, 2));
console.log('Hazırdır:', `${BASE}/latest.json`);
