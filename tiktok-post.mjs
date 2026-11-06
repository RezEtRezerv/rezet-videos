// Günün Azərbaycan dilindəki videosunu TikTok-a göndərir (Content Posting API, Direct Post, fayl yükləmə ilə).
// GitHub Actions hər gün 08:00-da (Bakı) işə salır. Lazımdır: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN.
// TikTok tətbiqi yoxlamadan (audit) keçənə qədər videolar yalnız "SELF_ONLY" (gizli) ola bilər.
// Audit keçəndən sonra GitHub-da TIKTOK_PRIVACY dəyişənini PUBLIC_TO_EVERYONE edin.
const KEY = process.env.TIKTOK_CLIENT_KEY, SECRET = process.env.TIKTOK_CLIENT_SECRET, REFRESH = process.env.TIKTOK_REFRESH_TOKEN;
const PRIVACY = process.env.TIKTOK_PRIVACY || 'SELF_ONLY';
const LATEST = (process.env.PAGES_URL || 'https://rezetrezerv.github.io/rezet-videos').replace(/\/$/, '') + '/latest.json';
const API = 'https://open.tiktokapis.com/v2';
const today = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);

if (!KEY || !SECRET || !REFRESH) { console.log('TikTok açarları əlavə edilməyib, TikTok buraxılır.'); process.exit(0); }


// 1. Giriş: refresh token ilə qısa müddətli access token alınır
const tok = await (await fetch(`${API}/oauth/token/`, {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, grant_type: 'refresh_token', refresh_token: REFRESH })
})).json();
if (!tok.access_token) throw new Error('TikTok girişi alınmadı: ' + (tok.error_description || tok.error || JSON.stringify(tok)));
if (tok.refresh_token && tok.refresh_token !== REFRESH) console.log('Qeyd: TikTok yeni refresh token verdi. Köhnəsi işləməyi dayandırsa, tiktok-auth.mjs-i yenidən işlədin.');
console.log('TikTok girişi işləyir ✅');
// Giriş əvvəl yoxlanılır ki, açar problemi videonun olub-olmamasından asılı olmadan görünsün
const latest = await (await fetch(LATEST, { cache: 'no-store' })).json();
if (latest.date !== today) { console.log(`Bu günün videosu yoxdur (son video: ${latest.date}). Heç nə göndərilmir.`); process.exit(0); }
const H = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json; charset=UTF-8' };
const call = async (path, body) => {
  const r = await (await fetch(`${API}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body || {}) })).json();
  if (r.error && r.error.code !== 'ok') throw new Error(`${path}: ${r.error.code} ${r.error.message}`);
  return r.data;
};

// 2. Hesabın icazə verdiyi gizlilik seçimləri yoxlanılır
const info = await call('/post/publish/creator_info/query/');
const privacy = info.privacy_level_options?.includes(PRIVACY) ? PRIVACY : 'SELF_ONLY';

// 3. Video faylı endirilir və TikTok-a yüklənir
const video = Buffer.from(await (await fetch(latest.az.video, { cache: 'no-store' })).arrayBuffer());
const caption = String(latest.az.caption || latest.az.title || '').slice(0, 2200);
const source_info = { source: 'FILE_UPLOAD', video_size: video.length, chunk_size: video.length, total_chunk_count: 1 };
// Tətbiq TikTok yoxlamasından keçməyibsə, birbaşa paylaşma yalnız gizli hesablara icazəlidir.
// Belə halda video qaralama kimi TikTok-un gələnlər qutusuna göndərilir: telefonda bir toxunuşla paylaşırsınız.
let init, inbox = process.env.TIKTOK_MODE === 'inbox';
if (!inbox) {
  try {
    init = await call('/post/publish/video/init/', { post_info: { title: caption, privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false, video_cover_timestamp_ms: 1500 }, source_info });
  } catch (e) {
    console.log('Birbaşa paylaşma alınmadı (' + e.message + '). Qaralama kimi göndərilir.');
    inbox = true;
  }
}
if (inbox) init = await call('/post/publish/inbox/video/init/', { source_info });
const up = await fetch(init.upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(video.length), 'Content-Range': `bytes 0-${video.length - 1}/${video.length}` },
  body: video
});
if (!up.ok) throw new Error('Video yüklənmədi: HTTP ' + up.status);

// 4. Nəticə yoxlanılır
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 6000));
  const st = await call('/post/publish/status/fetch/', { publish_id: init.publish_id });
  console.log('Status:', st.status);
  if (st.status === 'PUBLISH_COMPLETE') { console.log(`TikTok-a göndərildi ✅ (gizlilik: ${privacy})`); process.exit(0); }
  if (st.status === 'SEND_TO_USER_INBOX') { console.log('Qaralama TikTok-a göndərildi ✅ Telefonda TikTok bildirişini açıb paylaşın. Mətn: ' + caption.slice(0, 80)); process.exit(0); }
  if (st.status === 'FAILED') throw new Error('TikTok videonu qəbul etmədi: ' + (st.fail_reason || ''));
}
console.log('TikTok hələ emal edir. Bir neçə dəqiqəyə profildə görünməlidir.');
