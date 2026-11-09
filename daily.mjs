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
import { makeMusic, GENRES, pickBpm } from './music.mjs';

const FPS = 30, T = 18, MAX_TRIES = 3; // 3-cü cəhd yalnız yoxlama keçməyəndə işləyir
const MOCK = (process.argv.find(a => a.startsWith('--mock')) || '').split('=')[1] || (process.argv.includes('--mock') ? 'problem' : '');
const SITE = 'site', QA_DIR = 'qa', BASE = (process.env.PAGES_URL || 'https://rezetrezerv.github.io/rezet-videos').replace(/\/$/, '');
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Bakı vaxtı ilə tarix
const HISTORY = 'history.json';
const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '15:30', '16:00'];
const ICONS = ['cal', 'mail', 'star', 'clock', 'chart', 'users'];
// Mətni ən güclü model (Opus, yüksək səy) yazır, kadrları Sonnet yoxlayır (Azərbaycan mətnini şəkildə daha dəqiq oxuyur).
// Xərc: ayda təxminən 2-3 dollar.
const MODEL_WRITE = 'claude-opus-5-5', MODEL_CHECK = 'claude-opus-5-5';
const isWin = process.platform === 'win32';
const npx = (args, opts = {}) => execFileSync(isWin ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: isWin, ...opts });

// Səhnə növləri: Claude hər gün 3-nü özü seçib birləşdirir (ilk səhnə "hook", ən azı biri məhsulu göstərir)
const TYPES = ['calls', 'question', 'pov', 'chat', 'phone', 'panel', 'notifications', 'calendar', 'cards', 'beforeAfter', 'tips', 'review', 'quiz', 'headline', 'countdown', 'flood', 'split', 'list', 'caption'];
const HOOKS = ['calls', 'question', 'pov', 'chat', 'quiz', 'headline', 'flood', 'caption', 'countdown'];
const PRODUCT = ['phone', 'panel', 'notifications', 'calendar', 'split'];
// Hər səhnənin təxmini uzunluğu (saniyə). Musiqinin tempinə görə tam xanalara yuvarlaqlaşdırılır
const SEC = { calls: 7.2, question: 4.8, pov: 4.8, chat: 9.6, phone: 9.6, panel: 7.2, notifications: 7.2, calendar: 7.2, cards: 7.2, beforeAfter: 9.6, tips: 9.6, review: 7.2, quiz: 9.6, headline: 6.6, countdown: 9.6, flood: 8.4, split: 8.4, list: 9.6, caption: 5, cta: 7.2 };
const dayNo = Math.floor(Date.parse(today) / 864e5);
// Günün üslubu: Claude seçir, son günlərdə istifadə olunanlar qadağandır (src/Promo.jsx ilə eyni adlar)
const STYLE = {
  palette: ['forest', 'midnight', 'sunset', 'plum', 'electric', 'tangerine', 'hotpink', 'noir', 'ocean', 'cherry', 'royal'],
  font: ['inter', 'montserrat', 'unbounded', 'rubik', 'bricolage', 'sora', 'oswald', 'archivo'],
  look: ['glow', 'grid', 'bold', 'grain', 'stripes', 'footage'],
  anim: ['rise', 'pop', 'slam', 'type', 'mask', 'highlight'],
  trans: ['slide', 'wipe', 'flip', 'clock', 'iris', 'push', 'fade'],
  cta: ['center', 'stack', 'stamp'],
  music: Object.keys(GENRES)
};
// Neçə gün ərzində təkrar olmamalıdır
const NO_REPEAT = { palette: 6, font: 4, look: 2, anim: 3, trans: 3, cta: 1, music: 5 };
const FOOTAGE = !!process.env.PIXABAY_API_KEY;
const pastTypes = n => history.slice(-n).flatMap(h => h.types || String(h.format || '').split('+'));
const pastStyle = (k, n) => history.slice(-n).map(h => h.style?.[k]).filter(Boolean);
// Təkrarlanan üslub seçimi avtomatik dəyişdirilir (əlavə API xərci yoxdur)
function fixStyle(st = {}) {
  const out = {};
  for (const [k, opts] of Object.entries(STYLE)) {
    const banned = new Set(pastStyle(k, NO_REPEAT[k]));
    if (k === 'look' && !FOOTAGE) banned.add('footage');
    const free = opts.filter(o => !banned.has(o));
    out[k] = free.includes(st[k]) ? st[k] : free[(dayNo + k.length) % free.length] || opts[0];
  }
  return out;
}
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
  style: z.object({
    palette: z.enum(STYLE.palette), font: z.enum(STYLE.font), look: z.enum(STYLE.look), anim: z.enum(STYLE.anim),
    trans: z.enum(STYLE.trans), cta: z.enum(STYLE.cta), music: z.enum(STYLE.music)
  }).describe('The visual and musical identity of today\'s video. Must fit the mood of the idea and differ from recent days'),
  footage: z.array(z.string()).describe('Exactly 3 English stock-video search queries (2-4 words), one per scene, used only when look = footage'),
  az: Lang,
  en: Lang
});

const SYSTEM = `You write daily short vertical promo videos (Instagram Reels, YouTube Shorts, Facebook, LinkedIn) for RezEt, an online booking platform for businesses in Azerbaijan.
What RezEt does: customers book online 24/7 without calling; they get email confirmation and an email reminder 2 hours before; the business manages bookings, staff schedules, closed days and customers in one panel; verified customer reviews with stars; waitlist emails when a slot frees up; a free plan exists.

Each video = 3 scenes you choose and write (the "sequence") + a fixed RezEt logo ending.
Sequence rules: scene 1 must be a hook type (${HOOKS.join(', ')}); at least one scene must show the product (${PRODUCT.join(', ')}); no scene type twice; never use a scene type from the last 2 videos (the banned list is given each day).
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
- quiz: a two-option quiz with a timer; option A (the old way) gets crossed out, option B (the RezEt way) wins. title = the quiz question (max 48); line max 50; items = [option A (max 40), option B (max 40)].
- headline: a playful "breaking news" card with a scrolling ticker. title = a funny, obviously light-hearted headline about everyday business life (max 60, never fake real-world news, never about real people, places' politics or tragedies); line max 50; items = [short label like "SON DƏQİQƏ" / "BREAKING" (max 16), ticker text (max 60)].
- countdown: huge 3, 2, 1 with one idea per number. title max 40; line max 50; items = exactly 3 short ideas for 3, 2 and 1 (max 34 each), building to a payoff on 1.
- flood: the screen fills with real-sounding customer messages, then they all fly away. title max 40; line max 50 (the relief / solution); items = exactly 6 short customer messages (max 34 each) like "Sabaha yer var?" or "Saat neçədə açıqsınız?".
- split: split screen, chaos on top, calm with RezEt below. title max 40; line max 50; items = [top label (max 16, e.g. "Without RezEt"), bottom label (max 16, e.g. "With RezEt"), top text (max 46), bottom text (max 46)].
- list: big outlined numbers 01-03 with common mistakes that get crossed out. title like "3 mistakes salons make" (max 40); line max 50 (how RezEt fixes them); items = exactly 3 mistakes (max 34 each).
- caption: a bold word-by-word social caption hook, best over real footage. title = the hook sentence (max 52); line max 50; items = [].

Style (field "style"; choose to fit the mood of the idea, never the same combination as recent days):
- palette: forest (deep green), midnight (navy + sky blue), sunset (warm red + gold), plum (purple + pink), electric (vivid blue + yellow), tangerine (bright orange), hotpink (magenta + yellow), noir (black + neon lime), ocean (teal + gold), cherry (red + cream), royal (violet + mint).
- font: inter (clean), montserrat (geometric), unbounded (wide, futuristic), rubik (friendly, rounded), bricolage (editorial, quirky), sora (modern tech), oswald (tall, condensed, uppercase, loud), archivo (strong grotesque).
- look (background): glow (soft light blobs), grid (retro neon perspective grid), bold (flat colour with big moving shapes), grain (film grain + light sweep), stripes (animated diagonal stripes), footage (real stock video clips behind the text).
- anim (how titles appear): rise, pop (bouncy), slam (big punch-in with shake), type (typewriter), mask (words slide out of a mask), highlight (last words get a marker highlight).
- trans (scene changes): slide, wipe, flip, clock, iris, push, fade.
- cta (ending layout): center, stack (big left-aligned), stamp (logo badge).
- music: lofi (chill jazzy), trap (hard 808s and hi-hats), house (four-on-the-floor, groovy), afro (afrobeats, log drums), synthwave (80s neon), acoustic (guitar, bright), mugham (Azerbaijani tar + daf fusion), funk (slap bass, clavinet). All genres are played as calm, soft background music. Match the mood: warm stories suit acoustic/afro/lofi, local or holiday ideas suit mugham, night/tech ideas suit synthwave, upbeat ideas suit house/funk/trap.
- footage: when look = footage, give 3 English search queries for royalty-free stock clips, one per scene, showing atmosphere WITHOUT recognizable faces, logos or brand names (e.g. "barber scissors closeup", "salon chair interior", "phone in hands", "restaurant table night", "clinic hallway"). The people in clips are not customers of the business: never say or imply they are.

Goal: videos that Azerbaijani business owners and their customers stop scrolling for, watch to the end and share.
Creative rules:
- The first 2 seconds decide everything. Use a specific, relatable, slightly surprising hook from real life in Azerbaijan (a barber with clippers in hand while the phone rings, a clinic receptionist with a queue, a restaurant on a Friday night, a salon before a wedding, a tour guide on a bus). Use light humour, a twist, a bold POV or a sharp question. No clichés like "Welcome" or "Do you want to grow?".
- Use the date: if a holiday, season or typical busy period is near (Novruz, weddings season, New Year, school start, summer trips, Friday evenings), you may build the idea around it. Never political, religious or controversial topics.
- Every video must feel completely new: new situation, new sector, new sequence, new wording, new joke, new look and new music. Never repeat a recent hook, topic, sequence or business name.
- Think like a top short-form creator: open a curiosity gap or a strong emotion in the first second, keep a surprise for the middle, land a satisfying payoff. Prefer formats people share or comment on: relatable pain, quizzes, playful "breaking news", countdowns, a flood of messages, a before/after split.
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
  const recent = history.slice(-30).map(h => `${h.date}: ${h.format || '-'} | ${h.sector} | ${h.topic} | ${h.biz}${h.hook ? ' | hook: ' + h.hook : ''}${h.style ? ' | style: ' + Object.values(h.style).join('/') : ''}`).join('\n') || 'none yet';
  const fix = feedback ? `\n\nA previous attempt today FAILED the automatic checks. Fix these problems:\n- ${feedback.join('\n- ')}` : '';
  const banned = [`scene types: ${[...new Set(pastTypes(2))].join(', ') || 'none'}`,
    ...Object.keys(STYLE).map(k => `${k}: ${[...new Set(pastStyle(k, NO_REPEAT[k]))].join(', ') || 'none'}`),
    ...(FOOTAGE ? [] : ['look: footage (not available today)'])].join('\n- ');
  const res = await client.beta.messages.parse({
    model: MODEL_WRITE,
    max_tokens: 20000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(Script) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Date: ${today} (${WEEKDAYS.en[weekdayNo]}).\nRecent videos (do not repeat their hooks, topics, sequences or names):\n${recent}\n\nBanned today (used too recently):\n- ${banned}${fix}\n\nWrite today's video.` }]
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
// [başlıq, alt sətir, element sayı, element uzunluğu]
const LIMITS = { calls: [42, 55, 1, 22], question: [48, 55, 0, 0], pov: [52, 55, 0, 0], chat: [40, 50, 3, 60], phone: [40, 50, 1, 24], panel: [40, 50, 3, 40], notifications: [40, 50, 3, 34], calendar: [40, 50, 0, 0], cards: [26, 50, 3, 28], beforeAfter: [40, 50, 6, 28], tips: [40, 50, 3, 44], review: [40, 50, 2, 90], quiz: [48, 50, 2, 40], headline: [60, 50, 2, 60], countdown: [40, 50, 3, 34], flood: [40, 50, 6, 34], split: [40, 50, 4, 46], list: [40, 50, 3, 34], caption: [52, 50, 0, 0] };
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
  const usedTypes = new Set(pastTypes(2));
  if (!MOCK) for (const t of seq) if (usedTypes.has(t)) bad.push(`scene type ${t} was used in the last 2 videos, choose another`);
  sc.sequence = seq;
  sc.style = fixStyle(sc.style);
  sc.footage = (sc.footage || []).map(q => String(q).replace(/[^\w\s-]/g, ' ').trim()).filter(Boolean).slice(0, 3);
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

/* ---------- 3. Real video klipləri (Pixabay, pulsuz lisenziya) ---------- */
// Hər səhnəyə ayrı klip. Üz və loqo olmayan "atmosfer" kadrları axtarılır. Alınmasa, video klipsiz hazırlanır.
async function getClips(queries) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key || !queries.length) return [];
  const used = new Set(history.flatMap(h => h.clips || []));
  const dir = path.join('public', 'footage');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const clips = [];
  for (const [i, q] of queries.entries()) {
    try {
      const res = await fetch(`https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&safesearch=true&per_page=30&order=popular`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const hits = ((await res.json()).hits || []).filter(h => h.duration >= 5 && !used.has(h.id) && !clips.some(c => c.id === h.id));
      const hit = hits[Math.floor(((dayNo * 7 + i * 3) % 10) / 10 * Math.min(hits.length, 10))];
      if (!hit) { console.log(`Klip tapılmadı: "${q}"`); continue; }
      const v = [hit.videos.large, hit.videos.medium, hit.videos.small].find(x => x?.url && x.width >= 960 && x.width <= 1920) || hit.videos.medium || hit.videos.small;
      const file = path.join(dir, `${today}-${i}.mp4`);
      fs.writeFileSync(file, Buffer.from(await (await fetch(v.url)).arrayBuffer()));
      clips.push({ id: hit.id, src: `footage/${today}-${i}.mp4`, frames: Math.floor(hit.duration * FPS) - 2 });
      console.log(`Klip ${i + 1}: "${q}" -> pixabay #${hit.id} (${v.width}x${v.height}, ${hit.duration}s)`);
    } catch (e) { console.log(`Klip alınmadı ("${q}"): ${e.message}`); }
  }
  return clips;
}

/* ---------- 4. Video ---------- */
// Hər səhnə musiqinin tam xanaları qədər davam edir (keçidlər ritmə düşür)
const planBars = (sc, bpm) => [...sc.sequence, 'cta'].map(t => Math.max(1, Math.round(SEC[t] / (240 / bpm))));
function build(sc, lang, bpm, musicFile, clips = []) {
  const v = sc[lang], barF = (60 / bpm) * 4 * FPS, bars = planBars(sc, bpm);
  const scenes = [
    ...v.scenes.map((s, i) => ({
      type: s.type, bars: bars[i], title: s.title, line: s.line, items: s.items,
      ...(clips.length ? { clip: clips[i % clips.length].src, clipFrames: clips[i % clips.length].frames } : {}),
      // Videoda 3 zəng kartı var, ona görə nişandakı rəqəm həmişə 3 olur
      ...(s.type === 'calls' ? { badge: String(s.items[0]).replace(/\d+/, '3') } : {}),
      ...(s.type === 'phone' ? { services: s.services, pick: sc.pick, time: sc.time, ok: s.items[0] } : {}),
      ...(s.type === 'cards' ? { icons: sc.icons } : {}),
      biz: sc.biz, bookedAt: sc.bookedAt, weekday: WEEKDAYS[lang][weekdayNo]
    })),
    { type: 'cta', bars: bars[bars.length - 1], title: 'RezEt', sub: v.ctaSub, button: v.ctaButton }
  ].map(s => ({ ...s, frames: Math.round(s.bars * barF) + T }));
  const style = { ...sc.style, look: sc.style.look === 'footage' && !clips.length ? 'glow' : sc.style.look };
  const props = { id: `${today}-${lang}`, lang, scenes, music: musicFile, style };
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
    const points = { phone: [0.2, 0.5, 0.88], chat: [0.4, 0.92], quiz: [0.4, 0.85], countdown: [0.27, 0.58, 0.9], flood: [0.55, 0.92] }[s.type] || [0.9];
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
How the scenes work (do NOT fail for these):
- A scene is an animation and you get 1-3 frames of it. Judge a scene by all of its frames together: something shown in one frame of a scene counts as shown.
- The phone scene animates in 3 steps: service list with prices, then the time picker, then the confirmation. Prices only appear in the first step.
- pov, question, tips, caption, countdown and list scenes are big text on a background by design; they have no picture.
- quiz: option A is crossed out and option B wins on purpose. countdown shows 3, 2, 1 one after another, each with its own line. flood: the messages fly away at the end on purpose. list: the mistakes get crossed out on purpose. headline is a playful "breaking news" style card, not real news.
- Backgrounds, colours, fonts and animations change every day on purpose. Real stock video clips may appear behind the text.
- A title or bottom line on two lines is fine if it reads well.
Also fail if a background video clip shows a clearly recognizable face in close-up, a readable logo or brand name, or anything inappropriate.
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

/* ---------- 6. Əsas axın ---------- */
const client = MOCK ? null : new Anthropic();
fs.mkdirSync(path.join('public', 'music'), { recursive: true });
let clips = [], clipKey = '';

// Musiqi (seçilən janr, səhnə keçidlərində zərb) + iki video
async function produce(sc, withFrames = true) {
  const bpm = pickBpm(sc.style.music, today), bars = planBars(sc, bpm);
  const marks = bars.slice(0, -1).map((_, i) => bars.slice(0, i + 1).reduce((a, b) => a + b, 0));
  if (sc.style.look === 'footage') {
    const k = (sc.footage || []).join('|');
    if (k !== clipKey) { clips = await getClips(sc.footage || []); clipKey = k; }
  } else clips = [];
  const m = makeMusic({ seed: today, genre: sc.style.music, bpm, bars: bars.reduce((a, b) => a + b, 0), marks, file: path.join('public', 'music', `${today}.wav`) });
  console.log(`Üslub: ${Object.entries(sc.style).map(([k, v]) => `${k}=${v}`).join(', ')} | ${m.bpm} bpm${clips.length ? ` | ${clips.length} klip` : ''}`);
  const shots = [];
  for (const lang of ['az', 'en']) {
    const { out, scenes } = build(sc, lang, bpm, `music/${today}.wav`, sc.style.look === 'footage' ? clips : []);
    if (withFrames) shots.push(...frames(lang, out, scenes));
  }
  return shots;
}

let sc, feedback = null, log = [];
for (let attempt = 1; ; attempt++) {
  fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE, { recursive: true });
  fs.rmSync(QA_DIR, { recursive: true, force: true }); fs.mkdirSync(QA_DIR, { recursive: true });
  removed.length = 0;
  try {
  sc = scrub(await writeScript(client, feedback));
  if (removed.length) console.log('Avtomatik silindi (şəxsi məlumat):', removed.join(', '));
  const bad = check(sc);
  console.log(`Cəhd ${attempt} | format: ${FORMAT} | ${sc.topic} | ${sc.sector} | ${sc.biz}`);
  if (bad.length) {
    console.log('Mətn yoxlaması keçmədi:', bad);
    log.push({ attempt, stage: 'text', problems: bad });
    feedback = bad;
  } else {
    const shots = await produce(sc);
    const r = await review(client, sc, shots);
    log.push({ attempt, stage: 'visual', ...r });
    if (r.pass) { console.log('Vizual yoxlama keçdi ✅'); break; }
    console.log('Vizual yoxlama keçmədi:', r.problems);
    feedback = r.problems;
  }
  } catch (e) {
    // API və ya render xətası: işi dayandırmırıq, növbəti cəhdə keçirik
    console.log('Xəta:', e.message);
    log.push({ attempt, stage: 'error', problems: [String(e.message)] });
  }
  if (attempt >= MAX_TRIES) {
    // Ehtiyat plan: əvvəlcədən yoxlanmış hazır ssenarilərdən biri növbə ilə paylaşılır, iş heç vaxt qırmızı bitmir
    const names = fs.readdirSync('mock-scripts').filter(f => f.endsWith('.json')).sort();
    const pickName = names[history.filter(h => h.fallback).length % names.length];
    console.log(`${MAX_TRIES} cəhd keçmədi, ehtiyat video paylaşılır: ${pickName}`);
    sc = scrub(JSON.parse(fs.readFileSync(path.join('mock-scripts', pickName), 'utf8')));
    FORMAT = sc.sequence.join('+');
    sc.style = fixStyle({ ...(sc.style || {}), look: (sc.style || {}).look === 'footage' ? 'glow' : sc.style?.look });
    fs.rmSync(SITE, { recursive: true, force: true }); fs.mkdirSync(SITE, { recursive: true });
    await produce({ ...sc, style: { ...sc.style, look: sc.style.look === 'footage' ? 'glow' : sc.style.look } }, false);
    sc.fallback = true;
    log.push({ attempt: 'fallback', stage: 'fallback', file: pickName });
    break;
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
const usedStyle = { ...sc.style, look: sc.style.look === 'footage' && !clips.length ? 'glow' : sc.style.look };
history.push({ date: today, format: FORMAT, types: sc.sequence, style: usedStyle, sector: sc.sector, topic: sc.topic, biz: sc.biz, hook: sc.az.scenes[0]?.title, ...(clips.length && usedStyle.look === 'footage' ? { clips: clips.map(c => c.id) } : {}), ...(sc.fallback ? { fallback: true } : {}) });
fs.writeFileSync(HISTORY, JSON.stringify(history.slice(-90), null, 2));
console.log('Hazırdır:', `${BASE}/latest.json`);
