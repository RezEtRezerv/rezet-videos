// TikTok-a bir dəfəlik giriş: refresh token alınır və GitHub Secrets-ə əlavə olunur.
// Öz terminalınızda işlədin (açarlar heç yerə göndərilmir):
//   PowerShell:  $env:TIKTOK_CLIENT_KEY="..."; $env:TIKTOK_CLIENT_SECRET="..."; node tiktok-auth.mjs
// Sandbox üçün sandbox açarlarını, əsas (production) üçün production açarlarını istifadə edin.
import readline from 'node:readline/promises';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const KEY = process.env.TIKTOK_CLIENT_KEY, SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT = process.env.TIKTOK_REDIRECT || 'https://rezerv.rezervaz.workers.dev/tiktok-callback.html';
if (!KEY || !SECRET) { console.error('TIKTOK_CLIENT_KEY və TIKTOK_CLIENT_SECRET təyin edilməyib.'); process.exit(1); }

const state = crypto.randomBytes(12).toString('hex');
const url = 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({
  client_key: KEY, response_type: 'code', scope: 'user.info.basic,video.upload,video.publish', redirect_uri: REDIRECT, state
});
console.log('\n1) Bu linki brauzerdə açın, RezEt TikTok hesabı ilə daxil olun və icazə verin:\n\n' + url + '\n');
console.log('2) Açılan səhifədə "Kodu kopyala" düyməsini basın.\n');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('3) Kodu bura yapışdırıb Enter basın: ')).trim();
rl.close();

const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, code, grant_type: 'authorization_code', redirect_uri: REDIRECT })
});
const j = await res.json();
if (!j.refresh_token) { console.error('\nAlınmadı:', j.error || '', j.error_description || JSON.stringify(j)); process.exit(1); }
// Token ekranda göstərilmir (uzun sətir kopyalanarkən qırıla bilər): fayla yazılır və Notepad-də açılır
fs.writeFileSync('tiktok-token.txt', j.refresh_token);
console.log('\nHazırdır ✅  Token tiktok-token.txt faylına yazıldı və Notepad-də açılır.');
console.log('Notepad-də Ctrl+A, sonra Ctrl+C edin və GitHub-da TIKTOK_REFRESH_TOKEN-ə yapışdırın. Sonra faylı silin.');
if (process.platform === 'win32') spawn('notepad', ['tiktok-token.txt'], { detached: true, stdio: 'ignore' }).unref();
console.log(`\nİcazələr: ${j.scope}. Token ${Math.round((j.refresh_expires_in || 0) / 86400)} gün etibarlıdır, sonra bu skripti yenidən işlədin.\n`);
