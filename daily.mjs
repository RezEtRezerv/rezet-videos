// Gündəlik video: Claude ssenari yazır, Remotion iki video hazırlayır (az + en),
// sonra Claude hazır videonun kadrlarına baxıb yoxlayır. Problem varsa, ssenari yenidən yazılır (3 cəhdə qədər).
// Yoxlamadan keçməyən video heç vaxt paylaşılmır.
// İstifadə: node daily.mjs                    (ANTHROPIC_API_KEY lazımdır)
//           node daily.mjs --mock=problem     (Claude-suz yerli sınaq: problem | beforeAfter | tips | story)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { makeMusic } from './music.mjs';

const FPS = 30, T = 18, MAX_TRIES = 2; // xərc az olsun deyə ən çox 2 cəhd
const MOCK = (process.argv.find(a => a.startsWith('--mock')) || '').split('=')[1] || (process.argv.includes('--mock') ? 'problem' : '');
const SITE = 'site', QA_DIR = 'qa', BASE = (process.env.PAGES_URL || 'https://rezetrezerv.github.io/rezet-videos').replace(/\/$/, '');
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Bakı vaxtı ilə tarix
const HISTORY = 'history.json';
const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '15:30', '16:00'];
const ICONS = ['cal', 'mail', 'star', 'clock', 'chart', 'users'];
// Mətni ən güclü model (Opus) yazır, kadrları ucuz model (Haiku) yoxlayır. Xərc: ayda təxminən 1.3 dollar (5 dollar ~3-4 aya çatır).
const MODEL_WRITE = 'claude-opus-5-5', MODEL_CHECK = 'claude-haiku-5-5';
const isWin = process.platform === 'win32';
const npx = (args, opts = {}) => execFileSync(isWin ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: isWin, ...opts });

// 4 video formatı gün-gün növbə ilə gəlir, hər formatın öz səhnələri var
const FORMATS = {
  problem: ['calls', 'phone', 'cards'],
  beforeAfter: ['question', 'beforeAfter', 'panel'],
  tips: ['question', 'tips', 'phone'],
  story: ['calls', 'panel', 'review']
};
const BARS = { calls: 3, question: 2, phone: 4, cards: 3, beforeAfter: 4, panel: 3, tips: 4, review: 3, cta: 3 };
const dayNo = Math.floor(Date.parse(today) / 864e5);
const FORMAT = MOCK || Object.keys(FORMATS)[dayNo % 4];

/* ---------- 1. Ssenari ---------- */
const Scene = z.object({
  type: z.enum(['calls', 'question', 'phone', 'cards', 'beforeAfter', 'panel', 'tips', 'review']),
  title: z.string(),
  line: z.string(),
  items: z.array(z.string()),
  services: z.array(z.object({ name: z.string(), price: z.number().int() }))
});
const Lang = z.object({
  scenes: z.array(Scene).describe('Exactly 3 scenes, in the required order'),
  ctaSub: z.string().describe('Under the RezEt logo, max 34 characters'),
  ctaButton: z.string().describe('Button text, max 20 characters'),
  title: z.string().describe('YouTube title, max 80 characters, no hashtags'),
  caption: z.string().describe('Post caption: 2-3 sentences + hashtags, no links or URLs')
});
const Script = z.object({
  topic: z.string().describe('One-line topic of today in English'),
  sector: z.enum(['barber', 'beauty', 'clinic', 'restaurant', 'tour']),
  biz: z.string().describe('Invented business name, max 22 characters'),
  pick: z.number().int().describe('Index 0-2 of the service the customer picks in the phone scene'),
  time: z.enum(SLOTS),
  icons: z.array(z.enum(ICONS)).describe('Exactly 3 icons matching the 3 benefit items of a cards scene, in order'),
  az: Lang,
  en: Lang
});

const SYSTEM = `You write daily short vertical promo videos (Instagram Reels, YouTube Shorts, Facebook, LinkedIn) for RezEt, an online booking platform for businesses in Azerbaijan.
What RezEt does: customers book online 24/7 without calling; they get email confirmation and an email reminder 2 hours before; the business manages bookings, staff schedules, closed days and customers in one panel; verified customer reviews with stars; waitlist emails when a slot frees up; a free plan exists.

Each video = 3 scenes you write + a fixed RezEt logo ending. Scene types and how to fill them (unused fields: empty string or empty array):
- calls: title = short problem hook (max 42 chars); line = max 55 chars; items = [badge like "3 missed calls" (max 22)].
- question: title = a sharp question to the viewer (max 48); line = max 55; items = [].
- phone: a customer books on a phone. title max 40; line max 50; services = exactly 3 services of the business {name max 20, price in AZN}; items = [confirmation text like "Booking confirmed" (max 24)].
- cards: title max 26; line max 50; items = exactly 3 RezEt benefits (max 28 each).
- beforeAfter: title max 40; line max 50; items = exactly 6: first 3 = problems before (max 28), last 3 = the same things solved with RezEt (max 28).
- panel: the owner's panel with today's bookings. title max 40; line max 50; items = exactly 3 bookings formatted "First name + surname initial · Service · HH:MM" (e.g. "Leyla M. · Manicure · 10:30"), times ascending.
- tips: title like "3 ways to …" (max 40); line max 50; items = exactly 3 practical, useful tips for business owners (max 44 each); at least one tip is solved by RezEt.
- review: title max 40; line max 50; items = [reviewer "First name + surname initial" (max 16), a short realistic customer review of the business (max 90)].

Rules:
- Write the Azerbaijani version first (natural, correct Azerbaijani with ə, ğ, ı, ö, ü, ş, ç), then the English version for LinkedIn (natural professional English, not a literal translation). Both versions use the same scene types in the same order.
- Make the first scene a strong hook: specific, relatable, creates curiosity in 2 seconds. No clichés like "Welcome" or "Do you want to grow?".
- Every video must feel fresh: new angle, new situation, new wording. Rotate sectors. Do not repeat a recent topic, hook or business name.
- The business must have an invented name that does not exist: a coined word plus a type, like "Nərvix Barber Studio" or "Lumora Clinic". Never use real brands or common generic names. People's names are invented too.
- No website links, URLs, phone numbers, emails or social handles anywhere.
- No invented statistics, percentages, prices for RezEt, or promises RezEt cannot keep. No competitor names.
- Professional, warm, confident tone. Respect every length limit; shorter is better.`;

async function writeScript(client, feedback) {
  if (MOCK) return JSON.parse(fs.readFileSync(`mock-scripts/${MOCK}.json`, 'utf8'));
  const recent = history.slice(-30).map(h => `${h.date}: ${h.format || '-'} | ${h.sector} | ${h.topic} | ${h.biz}`).join('\n') || 'none yet';
  const need = FORMATS[FORMAT].join(', ');
  const fix = feedback ? `\n\nA previous attempt today FAILED the visual quality check. Fix these problems (usually by using shorter, clearer text):\n- ${feedback.join('\n- ')}` : '';
  const res = await client.beta.messages.parse({
    model: MODEL_WRITE,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(Script) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Date: ${today}.\nToday's scene types, in this order: ${need}.\nRecent videos (avoid repeating them):\n${recent}${fix}\n\nWrite today's video.` }]
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude bu gün ssenari yazmaqdan imtina etdi');
  if (!res.parsed_output) throw new Error('Claude cavabı JSON kimi oxunmadı');
  return res.parsed_output;
}

/* ---------- 2. Mətn yoxlaması: limitlər, say, qadağalar ---------- */
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const NO_LINKS = /(https?:\/\/|www\.|\.(az|com|dev|net|org)\b|@\w)/i;
const LIMITS = { calls: [42, 55, 1, 22], question: [48, 55, 0, 0], phone: [40, 50, 1, 24], cards: [26, 50, 3, 28], beforeAfter: [40, 50, 6, 28], panel: [40, 50, 3, 40], tips: [40, 50, 3, 44], review: [40, 50, 2, 90] };
function check(sc) {
  const bad = [];
  if (!sc.biz || sc.biz.length > 26) bad.push('biz name');
  sc.biz = cut(sc.biz, 26);
  if (!Number.isInteger(sc.pick) || sc.pick < 0 || sc.pick > 2) sc.pick = 1;
  if (!SLOTS.includes(sc.time)) sc.time = '10:30';
  sc.icons = (sc.icons || []).filter(i => ICONS.includes(i)).slice(0, 3);
  while (sc.icons.length < 3) sc.icons.push(['cal', 'mail', 'star'][sc.icons.length]);
  for (const k of ['az', 'en']) {
    const v = sc[k];
    if (NO_LINKS.test(JSON.stringify(v))) bad.push(k + ': contains a link');
    const types = (v.scenes || []).map(s => s.type).join(',');
    if (types !== FORMATS[FORMAT].join(',')) { bad.push(`${k}: scenes must be ${FORMATS[FORMAT].join(', ')} (got ${types})`); continue; }
    for (const s of v.scenes) {
      const [tMax, lMax, nItems, iMax] = LIMITS[s.type];
      s.title = cut(s.title, tMax + 6); s.line = cut(s.line, lMax + 6);
      s.items = (s.items || []).map(x => cut(x, iMax + 6)).slice(0, nItems);
      if (s.items.length !== nItems) bad.push(`${k} ${s.type}: needs ${nItems} items`);
      if (s.type === 'phone') {
        if (s.services?.length !== 3) bad.push(`${k} phone: needs 3 services`);
        s.services = (s.services || []).slice(0, 3).map(x => ({ name: cut(x.name, 22), price: Math.min(999, Math.max(1, Math.round(+x.price || 10))) }));
      }
      if (s.type === 'panel' && !s.items.every(x => /^.+·.+·\s*\d{2}:\d{2}$/.test(x))) bad.push(`${k} panel: bookings must look like "Leyla M. · Manicure · 10:30"`);
      if (!s.title) bad.push(`${k} ${s.type}: empty title`);
    }
    for (const [f, n] of [['ctaSub', 36], ['ctaButton', 22], ['title', 90]]) v[f] = cut(v[f], n);
    v.caption = String(v.caption || '').trim().slice(0, 2000);
  }
  return bad;
}

/* ---------- 3. Video ---------- */
function build(sc, lang, bpm, musicFile) {
  const v = sc[lang], barF = (60 / bpm) * 4 * FPS;
  const scenes = [
    ...v.scenes.map(s => ({
      type: s.type, bars: BARS[s.type], title: s.title, line: s.line, items: s.items,
      ...(s.type === 'calls' ? { badge: s.items[0] } : {}),
      ...(s.type === 'phone' ? { services: s.services, pick: sc.pick, time: sc.time, ok: s.items[0] } : {}),
      ...(s.type === 'cards' ? { icons: sc.icons } : {}),
      biz: sc.biz
    })),
    { type: 'cta', bars: BARS.cta, title: 'RezEt', sub: v.ctaSub, button: v.ctaButton }
  ].map(s => ({ ...s, frames: Math.round(s.bars * barF) + T }));
  const props = { id: `${today}-${lang}`, lang, scenes, music: musicFile };
  const pf = `props-${lang}.json`;
  fs.writeFileSync(pf, JSON.stringify(props, null, 2));
  const out = path.join(SITE, `${today}-${lang}.mp4`);
  npx(['remotion', 'render', 'src/index.jsx', 'Promo', out, `--props=${pf}`, '--crf=18', '--log=error']);
  return { out, scenes };
}

/* ---------- 4. Vizual yoxlama: hazır videodan kadrlar götürülür və Claude baxır ---------- */
function frames(lang, video, scenes) {
  const shots = [];
  let start = 0;
  scenes.forEach((s, i) => {
    const from = start + (i ? T : 0), len = s.frames - (i ? T : 0);
    const points = s.type === 'phone' ? [0.5, 0.88] : [0.88];
    for (const p of points) shots.push({ label: `${lang} scene ${i + 1} (${s.type})`, t: (from + len * p) / FPS });
    start += s.frames - T;
  });
  return shots.map((s, i) => {
    const file = path.join(QA_DIR, `${lang}-${i + 1}.jpg`);
    npx(['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-ss', s.t.toFixed(2), '-i', video, '-frames:v', '1', '-vf', 'scale=540:-1', '-q:v', '4', file]);
    return { ...s, file };
  });
}

const QA_SYSTEM = `You are a strict quality checker for short vertical promo videos of RezEt, an online booking platform. You receive still frames from two versions (Azerbaijani and English) and the script they were made from.
Fail the video if you see ANY of these:
- text cut off, running outside the screen or its box, overlapping other text or elements, or squeezed so it is hard to read;
- empty boxes, missing text, placeholders (undefined, NaN, [object Object], "…" in the middle of an important phrase), broken or wrong characters (for example missing Azerbaijani letters);
- spelling or grammar mistakes, unnatural phrasing, mixed languages in one version, or text that does not make sense;
- a business or person name that looks like a real, well-known brand;
- any URL, website, phone number, email or social handle;
- content that does not fit the business sector or is misleading.
Ignore small style preferences. Only report real problems a viewer would notice. Each problem: one short sentence naming the frame and what to change.`;
const QaResult = z.object({ pass: z.boolean(), problems: z.array(z.string()) });

async function review(client, sc, shots) {
  if (MOCK) return { pass: true, problems: [] };
  const content = [{ type: 'text', text: `Script:\n${JSON.stringify({ biz: sc.biz, az: sc.az.scenes, en: sc.en.scenes }, null, 1)}\n\nFrames:` }];
  for (const s of shots) {
    content.push({ type: 'text', text: s.label });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(s.file).toString('base64') } });
  }
  content.push({ type: 'text', text: 'Check every frame. pass = true only if there are no real problems.' });
  const res = await client.beta.messages.parse({
    model: MODEL_CHECK,
    max_tokens: 16000,
    output_config: { effort: 'low', format: betaZodOutputFormat(QaResult) },
    system: QA_SYSTEM,
    messages: [{ role: 'user', content }]
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return { pass: false, problems: ['Quality check could not run'] };
  return res.parsed_output;
}

/* ---------- 5. Əsas axın ---------- */
const client = MOCK ? null : new Anthropic();
fs.mkdirSync(path.join('public', 'music'), { recursive: true });
const bpm = 96 + (dayNo % 11); // hər gün bir az fərqli temp
makeMusic({ seed: today, bpm, bars: Object.values(FORMATS[FORMAT]).reduce((n, t) => n + BARS[t], BARS.cta), file: path.join('public', 'music', `${today}.wav`) });

let sc, feedback = null, log = [];
for (let attempt = 1; ; attempt++) {
  fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE, { recursive: true });
  fs.rmSync(QA_DIR, { recursive: true, force: true }); fs.mkdirSync(QA_DIR, { recursive: true });
  sc = await writeScript(client, feedback);
  const bad = check(sc);
  console.log(`Cəhd ${attempt} | format: ${FORMAT} | ${sc.topic} | ${sc.sector} | ${sc.biz}`);
  if (bad.length) {
    console.log('Mətn yoxlaması keçmədi:', bad);
    log.push({ attempt, stage: 'text', problems: bad });
    feedback = bad;
  } else {
    const shots = [];
    for (const lang of ['az', 'en']) {
      const { out, scenes } = build(sc, lang, bpm, `music/${today}.wav`);
      shots.push(...frames(lang, out, scenes));
    }
    const r = await review(client, sc, shots);
    log.push({ attempt, stage: 'visual', ...r });
    if (r.pass) { console.log('Vizual yoxlama keçdi ✅'); break; }
    console.log('Vizual yoxlama keçmədi:', r.problems);
    feedback = r.problems;
  }
  if (attempt >= MAX_TRIES) {
    fs.writeFileSync(path.join(QA_DIR, 'report.json'), JSON.stringify(log, null, 2));
    throw new Error(`${MAX_TRIES} cəhddən sonra video yoxlamadan keçmədi. Bu gün heç nə paylaşılmır. Səbəblər qa/report.json-dadır.`);
  }
}

fs.writeFileSync(path.join(QA_DIR, 'report.json'), JSON.stringify(log, null, 2));
const entry = lang => ({ video: `${BASE}/${today}-${lang}.mp4`, title: sc[lang].title, caption: sc[lang].caption });
fs.writeFileSync(path.join(SITE, 'latest.json'), JSON.stringify({ date: today, topic: sc.topic, format: FORMAT, az: entry('az'), en: entry('en') }, null, 2));
fs.writeFileSync(path.join(SITE, 'index.html'), `<!doctype html><meta charset="utf-8"><title>RezEt videos</title><h1>${today}</h1><video src="${today}-az.mp4" controls width="360"></video><video src="${today}-en.mp4" controls width="360"></video>`);
history.push({ date: today, format: FORMAT, sector: sc.sector, topic: sc.topic, biz: sc.biz });
fs.writeFileSync(HISTORY, JSON.stringify(history.slice(-90), null, 2));
console.log('Hazırdır:', `${BASE}/latest.json`);
