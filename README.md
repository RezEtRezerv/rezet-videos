# RezEt gündəlik videolar

Hər gün 06:00-da (Bakı vaxtı) GitHub Actions:

1. Claude-dan günün ssenarisini alır (Azərbaycan + ingilis dili).
2. Remotion ilə 2 şaquli video hazırlayır (fon musiqisi də kodla yaradılır, müəllif hüququ problemi yoxdur).
3. Videoları və `latest.json` faylını GitHub Pages-ə qoyur:
   `https://rezetrezerv.github.io/rezet-videos/latest.json`

Make.com 08:00-da `latest.json`-u oxuyur və videoları Instagram, Facebook, YouTube (az) və LinkedIn (en) hesablarında paylaşır.

## Fayllar

- `daily.mjs`: bütün gündəlik iş (ssenari, yoxlama, video, latest.json)
- `src/Promo.jsx`: videonun dizaynı (səhnələr, animasiyalar)
- `music.mjs`: fon musiqisi generatoru
- `mock-script.json`: Claude-suz yerli sınaq üçün nümunə ssenari
- `.github/workflows/daily.yml`: gündəlik cədvəl

## Yerli sınaq

```bash
npm install
node daily.mjs --mock
```

Videolar `site/` qovluğunda yaranır.

## Lazım olan GitHub ayarları

- Secret: `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions)
- Pages: Settings → Pages → Source: **GitHub Actions**
