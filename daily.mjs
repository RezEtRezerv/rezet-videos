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
// Mətni ən güclü model (Opus, yüksək səy) yazır, kadrları Sonnet yoxlayır (Azərbaycan mətnini şəkildə daha dəqiq oxuyur).
// Xərc: ayda təxminən 2-3 dollar.
const MODEL_WRITE = 'claude-opus-5-5', MODEL_CHECK = 'claude-sonnet-5-5';
const isWin = process.platform === 'win32';
const npx = (args, opts = {}) => execFileSync(isWin ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: isWin, ...opts });

// Səhnə növləri: Claude hər gün 3-nü özü seçib birləşdirir (ilk səhnə "hook", ən azı biri məhsulu göstərir)
const TYPES = ['calls', 'question', 'pov', 'chat', 'phone', 'panel', 'notifications', 'calendar', 'cards', 'beforeAfter', 'tips', 'review'];
const HOOKS = ['calls', 'question', 'pov', 'chat'];
const PRODUCT = ['phone', 'panel', 'notifications', 'calendar'];
const BARS = { calls: 3, question: 2, pov: 2, chat: 4, phone: 4, panel: 3, notifications: 3, calendar: 3, cards: 3, beforeAfter: 4, tips: 4, review: 3, cta: 3 };
const dayNo = Math.floor(Date.parse(today) / 864e5);
const THEME = ['forest', 'midnight', 'sunset', 'plum'][dayNo % 4]; // hər gün fərqli fon rəngi
const WEEKDAYS = {
  az: ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};
const weekdayNo = new Date(today + 'T12:00:00Z').getUTCDay();
let FORMAT = MOCK || '';

/* ---------- 1. Ssenari ---------- */
const Scene = z.object({
  type: z.enum(TYPES),
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
  angle: z.string().describe('In one short English line: the creative angle / hook idea and why it will stop the scroll'),
  sequence: z.array(z.enum(TYPES)).describe('Exactly 3 scene types in order'),
  sector: z.enum(['barber', 'beauty', 'clinic', 'restaurant', 'tour']),
  biz: z.string().describe('Invented business name, max 22 characters'),
  pick: z.number().int().describe('Index 0-2 of the service the customer picks in the phone scene'),
  time: z.enum(SLOTS).describe('The appointment time the customer books (shown in the phone)'),
  bookedAt: z.string().describe('HH:MM clock time WHEN the customer makes the booking (shown on the phone status bar and lock screen), e.g. "23:10" for a late-night booking'),
  icons: z.array(z.enum(ICONS)).describe('Exactly 3 icons matching the 3 benefit items of a cards scene, in order'),
  az: Lang,
  en: Lang
});

const SYSTEM = `You write daily short vertical promo videos (Instagram Reels, YouTube Shorts, Facebook, LinkedIn) for RezEt, an online booking platform for businesses in Azerbaijan.
What RezEt does: customers book online 24/7 without calling; they get email confirmation and an email reminder 2 hours before; the business manages bookings, staff schedules, closed days and customers in one panel; verified customer reviews with stars; waitlist emails when a slot frees up; a free plan exists.

Each video = 3 scenes you choose and write (the "sequence") + a fixed RezEt logo ending.
Sequence rules: scene 1 must be a hook type (calls, question, pov, chat); at least one scene must show the product (phone, panel, notifications, calendar); no scene type twice; do not reuse a recent sequence.
Scene types and how to fill them (unused fields: empty string or empty array):
- calls: three missed-call cards. title = short problem hook (max 42 chars); line = max 55 chars; items = [badge "3 missed calls" (the number is always 3)].
- question: title = a sharp question to the viewer (max 48); line = max 55; items = [].
- pov: big bold "POV:" statement that puts the viewer in a situation, e.g. "you answer the phone with dye on your hands" (title max 52, no "POV" word in it); line max 55; items = [].
- chat: a short messenger exchange. title max 40; line max 50; items = [customer message (max 60), business reply (max 60), small label between them like "3 hours later" or "1 second later" (max 20)].
- notifications: phone lock screen with 3 RezEt notifications. title max 40; line max 50; items = exactly 3 short notifications (max 34 each), e.g. "New booking: Leyla M." / "Reminder sent to client" / "New 5-star review".
- calendar: the business's week calendar filling up with bookings (visual only). title max 40; line max 50; items = [].
- phone: a customer books on a phone. title max 40; line max 50; services = exactly 3 services of the business {name max 20, price in AZN}; items = [confirmation text like "Booking confirmed" (max 24)].
- cards: title max 26; line max 50; items = exactly 3 RezEt benefits (max 28 each).
- beforeAfter: title max 40; line max 50; items = exactly 6: first 3 = problems before (max 28), last 3 = the same things solved with RezEt (max 28).
- panel: the owner's panel with today's bookings. title max 40; line max 50; items = exactly 3 bookings formatted "First name + surname initial · Service · HH:MM" (e.g. "Leyla M. · Manicure · 10:30"), times ascending.
- tips: title like "3 ways to …" (max 40); line max 50; items = exactly 3 practical, useful tips for business owners (max 44 each); at least one tip is solved by RezEt.
- review: a 5-star review card (always 5 stars). title max 40; line max 50; items = [reviewer "First name + surname initial" (max 16), a short realistic customer review of the business (max 90)].

Goal: videos that Azerbaijani business owners and their customers stop scrolling for, watch to the end and share.
Creative rules:
- The first 2 seconds decide everything. Use a specific, relatable, slightly surprising hook from real life in Azerbaijan (a barber with clippers in hand while the phone rings, a clinic receptionist with a queue, a restaurant on a Friday night, a salon before a wedding, a tour guide on a bus). Use light humour, a twist, a bold POV or a sharp question. No clichés like "Welcome" or "Do you want to grow?".
- Use the date: if a holiday, season or typical busy period is near (Novruz, weddings season, New Year, school start, summer trips, Friday evenings), you may build the idea around it. Never political, religious or controversial topics.
- Every video must feel completely new: new situation, new sector, new sequence, new wording, new joke. Never repeat a recent hook, topic, sequence or business name.
- No emoji in on-screen texts (they may not render). Emoji are fine in the caption.
- Keep each on-screen text short and punchy. One idea per scene. The story must flow: problem, solution with RezEt, payoff.
- The caption starts with a strong first line, then 1-2 short sentences, then 6-10 relevant hashtags mixing Azerbaijani and local tags (e.g. #bakı #azərbaycan #biznes plus sector tags).
Consistency rules (the video is checked automatically):
- Text and visuals must always match. If you mention a clock time anywhere, it must be exactly "time" (the appointment) or "bookedAt" (when the customer books). Panel booking times are only the panel's own list.
- Counts must match what is shown: calls always show 3 missed calls, tips always 3 tips, cards always 3 items, reviews always 5 stars.
- The service the customer picks (services[pick]) and its price must match any mention in the texts.
Language rules:
- Write the Azerbaijani version first (natural, correct, modern spoken Azerbaijani with ə, ğ, ı, ö, ü, ş, ç), then the English version for LinkedIn (natural professional English, not a literal translation). Both versions use the same scene types in the same order.
- The business must have an invented name that does not exist: a coined word plus a type, like "Nərvix Barber Studio" or "Lumora Clinic". Never use real brands or common generic names. People's names are invented too.
- No website links, URLs, phone numbers, emails or social handles anywhere.
- No invented statistics, percentages, prices for RezEt, or promises RezEt cannot keep. No competitor names.
- Professional, warm, confident tone. Respect every length limit; shorter is better.`;

async function writeScript(client, feedback) {
  if (MOCK) return JSON.parse(fs.readFileSync(`mock-scripts/${MOCK}.json`, 'utf8'));
  const recent = history.slice(-30).map(h => `${h.date}: ${h.format || '-'} | ${h.sector} | ${h.topic} | ${h.biz}${h.hook ? ' | hook: ' + h.hook : ''}`).join('\n') || 'none yet';
  const fix = feedback ? `\n\nA previous attempt today FAILED the automatic checks. Fix these problems:\n- ${feedback.join('\n- ')}` : '';
  const res = await client.beta.messages.parse({
    model: MODEL_WRITE,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(Script) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Date: ${today} (${WEEKDAYS.en[weekdayNo]}).\nRecent videos (do not repeat their hooks, topics, sequences or names):\n${recent}${fix}\n\nWrite today's video.` }]
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude bu gün ssenari yazmaqdan imtina etdi');
  if (!res.parsed_output) throw new Error('Claude cavabı JSON kimi oxunmadı');
  return res.parsed_output;
}

/* ---------- 2. Mətn yoxlaması: limitlər, say, qadağalar ---------- */
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
// Şəxsi və əlaqə məlumatı avtomatik silinir: e-poçt, link, telefon nömrəsi, @istifadəçi adı.
// Heşteqlər (#...), saatlar (10:30), qiymətlər və "7/24" qalır.
const PRIVATE = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'email'],
  [/\b(?:https?:\/\/|www\.)\S+/gi, 'link'],
  [/\b(?:[\w-]+\.)+(?:az|com|net|org|dev|io|info|ru|tr|me|app|co)\b(?:\/\S*)?/gi, 'link'],
  [/(?:\+|\b00)\d[\d\s().-]{6,}\d/g, 'phone'],
  [/\b\d{2,4}[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?\b/g, 'phone'],
  [/\b\d{7,}\b/g, 'phone'],
  [/(^|[\s(])@[\w.]{2,}/g, 'handle']
];
const removed = [];
function scrub(v, where = '') {
  if (typeof v === 'string') {
    let s = v;
    for (const [re, kind] of PRIVATE) s = s.replace(re, (m, pre) => { removed.push(`${where}: ${kind}`); return typeof pre === 'string' && kind === 'handle' ? pre : ''; });
    return s === v ? v : s.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
  }
  if (Array.isArray(v)) return v.map((x, i) => scrub(x, `${where}[${i}]`));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x, where ? `${where}.${k}` : k)]));
  return v;
}
const NO_LINKS = /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.\w|\+\d{6,})/i;
const LIMITS = { calls: [42, 55, 1, 22], question: [48, 55, 0, 0], pov: [52, 55, 0, 0], chat: [40, 50, 3, 60], phone: [40, 50, 1, 24], panel: [40, 50, 3, 40], notifications: [40, 50, 3, 34], calendar: [40, 50, 0, 0], cards: [26, 50, 3, 28], beforeAfter: [40, 50, 6, 28], tips: [40, 50, 3, 44], review: [40, 50, 2, 90] };
const TIME_RE = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;
const hhmm = t => { const m = String(t).match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };
function check(sc) {
  const bad = [];
  if (!sc.biz || sc.biz.length > 26) bad.push('biz name');
  sc.biz = cut(sc.biz, 26);
  if (!Number.isInteger(sc.pick) || sc.pick < 0 || sc.pick > 2) sc.pick = 1;
  if (!SLOTS.includes(sc.time)) sc.time = '10:30';
  sc.bookedAt = hhmm(sc.bookedAt) || sc.time;
  sc.icons = (sc.icons || []).filter(i => ICONS.includes(i)).slice(0, 3);
  while (sc.icons.length < 3) sc.icons.push(['cal', 'mail', 'star'][sc.icons.length]);
  // Səhnə ardıcıllığı: 3 səhnə, ilki "hook", ən azı biri məhsulu göstərir, təkrar yoxdur, son 5 günün ardıcıllığı təkrarlanmır
  const seq = (sc.sequence || []).slice(0, 3);
  if (seq.length !== 3 || new Set(seq).size !== 3) bad.push('sequence must be exactly 3 different scene types');
  if (!HOOKS.includes(seq[0])) bad.push(`scene 1 must be one of: ${HOOKS.join(', ')}`);
  if (!seq.some(t => PRODUCT.includes(t))) bad.push(`at least one scene must be one of: ${PRODUCT.join(', ')}`);
  if (!MOCK && history.slice(-5).some(h => h.format === seq.join('+'))) bad.push(`sequence ${seq.join('+')} was used in the last 5 days, choose another`);
  sc.sequence = seq;
  FORMAT = seq.join('+');
  for (const k of ['az', 'en']) {
    const v = sc[k];
    if (NO_LINKS.test(JSON.stringify(v))) bad.push(k + ': contains a link');
    const types = (v.scenes || []).map(s => s.type).join(',');
    if (types !== seq.join(',')) { bad.push(`${k}: scenes must be ${seq.join(', ')} (got ${types})`); continue; }
    // Mətn və görüntü uyğun olmalıdır: mətndəki hər saat ya rezerv vaxtı, ya rezerv edilən an, ya da paneldəki vaxtdır
    const panelTimes = v.scenes.filter(s => s.type === 'panel').flatMap(s => (s.items || []).map(x => hhmm((x.match(TIME_RE) || [])[0] || '')));
    const allowed = new Set([sc.time, sc.bookedAt, ...panelTimes].filter(Boolean));
    for (const s of v.scenes) {
      const texts = [s.title, s.line, ...(s.type === 'panel' ? [] : s.items || [])];
      for (const t of texts.join(' ').match(TIME_RE) || []) if (!allowed.has(hhmm(t))) bad.push(`${k} ${s.type}: the text says ${t}, but the video shows ${[...allowed].join(' / ')}. Times in text must match the video.`);
    }
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
      // Videoda 3 zəng kartı var, ona görə nişandakı rəqəm həmişə 3 olur
      ...(s.type === 'calls' ? { badge: String(s.items[0]).replace(/\d+/, '3') } : {}),
      ...(s.type === 'phone' ? { services: s.services, pick: sc.pick, time: sc.time, ok: s.items[0] } : {}),
      ...(s.type === 'cards' ? { icons: sc.icons } : {}),
      biz: sc.biz, bookedAt: sc.bookedAt, weekday: WEEKDAYS[lang][weekdayNo]
    })),
    { type: 'cta', bars: BARS.cta, title: 'RezEt', sub: v.ctaSub, button: v.ctaButton }
  ].map(s => ({ ...s, frames: Math.round(s.bars * barF) + T }));
  const props = { id: `${today}-${lang}`, lang, scenes, music: musicFile, theme: THEME };
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
    const points = s.type === 'phone' ? [0.5, 0.88] : s.type === 'chat' ? [0.4, 0.92] : [0.9];
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
- any URL, website, phone number (even partly hidden), email, social handle, street address, ID or card number, or a person's full real-looking name (only first name + surname initial is allowed);
- content that does not fit the business sector or is misleading;
- any mismatch between the texts and the visuals: a time, number, name, service or price in a title or bottom line that differs from what the phone, panel, cards or notifications show (for example the title says 23:00 but the phone clock or booking shows 11:00, or "4 missed calls" while 3 are shown).
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

let sc, feedback = null, log = [];
for (let attempt = 1; ; attempt++) {
  fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE, { recursive: true });
  fs.rmSync(QA_DIR, { recursive: true, force: true }); fs.mkdirSync(QA_DIR, { recursive: true });
  removed.length = 0;
  sc = scrub(await writeScript(client, feedback));
  if (removed.length) console.log('Avtomatik silindi (şəxsi məlumat):', removed.join(', '));
  const bad = check(sc);
  console.log(`Cəhd ${attempt} | format: ${FORMAT} | ${sc.topic} | ${sc.sector} | ${sc.biz}`);
  if (bad.length) {
    console.log('Mətn yoxlaması keçmədi:', bad);
    log.push({ attempt, stage: 'text', problems: bad });
    feedback = bad;
  } else {
    // Musiqi seçilən səhnələrin uzunluğuna görə yaradılır
    makeMusic({ seed: today, bpm, bars: sc.sequence.reduce((n, t) => n + BARS[t], BARS.cta), file: path.join('public', 'music', `${today}.wav`) });
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
// Telefon üçün səhifə: günün videoları, başlıq və mətn, bir toxunuşla kopyalama (TikTok qaralaması üçün)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const block = (lang, label) => `<section><h2>${label}</h2><video src="${today}-${lang}.mp4" controls playsinline></video>
<p class="t">${esc(sc[lang].title)}</p><p class="c" id="c-${lang}">${esc(sc[lang].caption)}</p>
<button data-copy="c-${lang}">Mətni kopyala</button> <a href="${today}-${lang}.mp4" download>Videonu yüklə</a></section>`;
fs.writeFileSync(path.join(SITE, 'index.html'), `<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>RezEt videoları · ${today}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#F4F8F6;color:#10231D}h1{font-size:1.3rem;color:#0D5E4A}section{background:#fff;border-radius:16px;padding:16px;margin:0 0 16px;box-shadow:0 2px 10px rgba(0,0,0,.06)}video{width:100%;max-width:360px;border-radius:12px;display:block}.t{font-weight:700;margin:12px 0 4px}.c{white-space:pre-wrap;margin:0 0 12px}button,a{display:inline-block;background:#0D5E4A;color:#fff;border:0;border-radius:10px;padding:12px 16px;font-size:1rem;text-decoration:none;margin:4px 6px 0 0}a{background:#3DDC97;color:#062A21}</style>
<h1>RezEt · ${today}</h1>${block('az', 'Azərbaycanca (TikTok, Instagram, YouTube)')}${block('en', 'English (LinkedIn)')}
<script>document.addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;const t=document.getElementById(b.dataset.copy).textContent;try{await navigator.clipboard.writeText(t);b.textContent='Kopyalandı ✓'}catch{b.textContent='Mətni əl ilə seçin'}});</script></html>`);
history.push({ date: today, format: FORMAT, theme: THEME, sector: sc.sector, topic: sc.topic, biz: sc.biz, hook: sc.az.scenes[0]?.title });
fs.writeFileSync(HISTORY, JSON.stringify(history.slice(-90), null, 2));
console.log('Hazırdır:', `${BASE}/latest.json`);
