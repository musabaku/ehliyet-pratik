# Slide Gallery Pipeline

How the `/pics/` galleries are built — from raw input (PDF or screenshots) to the deployed page on GitHub Pages.

There are currently **3 galleries**:

| Path | Source | Slides | Categories |
|---|---|---|---|
| [`pics/index.html`](index.html) | Personal class screenshots (CleanShot, Zoom) | 171 | 3 lessons |
| [`pics/trafik-ders-kitabi/`](trafik-ders-kitabi/) | `trafikvecevredersi muharrem.pdf` (179p, MEB by Oktay TAŞCI) | 179 | 14 topics |
| [`pics/arac-teknigi-kitabi/`](arac-teknigi-kitabi/) | `aracteknigi.pdf` (61p, MEB by Oktay TAŞCI) | 61 | 10 topics |

All three reuse the same JS gallery widget: filter chips → grid of cards → click-to-zoom lightbox with arrow-key nav.

---

## When to use this pipeline

Use this when a textbook PDF (or a folder of screenshots) is **already exam-relevant slide material** that should be browsable as-is — not distilled into hand-crafted notes.

**Do NOT use this for:**
- Content that needs synthesis / English translation / hoca's class additions → those belong in `e-tusekon-portal/ders-notes/<konu>/*.md` written via the `/drive` skill
- Content that's already covered in the existing 4,450-question quiz bundle

The galleries and the markdown notes are **complementary**, not redundant — gallery preserves the original visual context (signs, road diagrams), notes distill exam tropes & teacher additions.

---

## Pipeline (PDF → gallery)

This is what was done for both `trafik-ders-kitabi/` and `arac-teknigi-kitabi/`. Token-efficient: **no slide-by-slide vision read** — only `pdftotext` headers + a sample peek.

### Step 1 — Map the table of contents (cheap)

Use `pdftotext -layout` to extract the first meaningful line of every page. This gives you a clean per-page outline without burning vision tokens on 179 images.

```bash
python3 << 'EOF'
import subprocess
result = subprocess.run(['pdftotext', '-layout', 'INPUT.pdf', '-'],
                       capture_output=True, text=True)
pages = result.stdout.split('\f')
for i, page in enumerate(pages, 1):
    lines = [l.strip() for l in page.split('\n') if l.strip() and 'Hazırlayan' not in l]
    title = ' | '.join(lines[:2])[:110] if lines else '(empty)'
    print(f"P{i:3d}: {title}")
EOF
```

Output looks like:
```
P 50: TRAFİK İŞARET LEVHALARI | Trafik Tanzim İşaretleri
P 51: TRAFİK İŞARET LEVHALARI | Trafik Tanzim İşaretleri
...
P 65: YOL ÇİZGİLERİ | Kesik yol çizgisi: ...
```

### Step 2 — Group pages into meaningful categories

**Anchor categories on the existing `ders-notes/<konu>/*.md` numbering** so the gallery and the notes line up. Where the PDF covers topics not yet in your notes, name the gap explicitly so it's easy to spot ("(new — not yet in notes)").

Aim for ~10–15 categories with 5–25 slides each. Fewer is too coarse to navigate; more clutters the filter bar.

Document the mapping in a table (see headers in this file).

### Step 3 — Render PDF pages to PNG

```bash
mkdir -p /tmp/render
pdftoppm -png -r 110 INPUT.pdf /tmp/render/p
```

- `-r 110` → 110 DPI. Good legibility, ~250–500 KB per page. **At 150 DPI files are ~3× larger** for marginal sharpness gain.
- Filenames come out as `p-001.png`, `p-002.png`, ...

Estimate: **179 pages → ~52 MB**, **61 pages → ~17 MB**.

### Step 4 — Organize into category folders

Copy each PNG into its category subfolder using the mapping from step 2. Keep the original page number in the filename (`page-001.png`, `page-002.png`, ...) so the deck order is preserved and you can correlate back to the PDF.

```python
categories = [
    ("01-tanimlar",             "Tanımlar (Trafik, Karayolu, Araçlar)",  1, 29),
    ("02-trafik-gorevlisi",     "Trafik Görevlisi & Işıklı İşaretler",  30, 44),
    # ...
]
for slug, label, start, end in categories:
    os.makedirs(slug, exist_ok=True)
    for pg in range(start, end+1):
        shutil.copy(f"/tmp/render/p-{pg:03d}.png", f"{slug}/page-{pg:03d}.png")
```

### Step 5 — URL-encode paths (CRITICAL)

⚠️ **Filenames with spaces, `@`, or hidden Unicode characters break in browsers.**

We hit this bug with the personal-screenshots gallery: CleanShot writes filenames containing ` ` (narrow no-break space). `encodeURI()` in JavaScript does NOT encode that character, so the `<img src>` request 404'd. Files appeared broken in the browser.

**Fix:** pre-encode paths in Python before embedding in JS, then use the path directly (no `encodeURI()` in JS):

```python
import urllib.parse
encoded = '/'.join(urllib.parse.quote(p, safe='') for p in path.split('/'))
# 'vehicle info part 1/...CleanShot at 8 .30.50@2x.png'
# becomes 'vehicle%20info%20part%201/...CleanShot%20at%208%E2%80%AF.30.50%402x.png'
```

For PDF-rendered slides this isn't strictly necessary (filenames are clean `page-001.png`), but the pipeline does it anyway for consistency.

### Step 6 — Build the gallery HTML

Reuse [`pics/trafik-ders-kitabi/index.html`](trafik-ders-kitabi/index.html) as the template. Only thing that changes per gallery:

1. The `<title>`, `<h1>`, and subtitle
2. The `const DATA = [...]` array
3. The hardcoded total page count in the lightbox (`' / ' + 179`)

Each `DATA` entry has shape:
```js
{
  category: "Tanımlar (Trafik, Karayolu, Araçlar)",
  date: "Pages 1-29",       // shown as the right-side meta
  count: 29,
  images: [
    { path: "01-tanimlar/page-001.png", page: 1 },
    { path: "01-tanimlar/page-002.png", page: 2 },
    ...
  ]
}
```

The widget itself (filters, grid, lightbox, keyboard nav) is identical across all 3 galleries — copy it whole, just swap data.

### Step 7 — Wire it up + push to GH Pages

1. Add a button on the main `pics/index.html` linking to the new gallery folder.
2. Copy the new folder into the `/tmp/ehliyet-pratik` clone of `musabaku/ehliyet-pratik`:
   ```bash
   cd /tmp && git clone https://github.com/musabaku/ehliyet-pratik.git
   cp -R "<source>/pics/<new-gallery>" /tmp/ehliyet-pratik/pics/
   cp "<source>/pics/index.html" /tmp/ehliyet-pratik/pics/index.html
   cd /tmp/ehliyet-pratik
   find pics -name ".DS_Store" -delete
   git add pics/
   git commit -m "Add <gallery name>"
   git push
   ```
3. Live within ~60 seconds at `https://musabaku.github.io/ehliyet-pratik/pics/<new-gallery>/`.

---

## Token / cost notes

The **only** vision read in the whole pipeline is the very first peek at ~10–15 PDF pages to confirm format/style and judge whether the slides are exam-worthy. After that:

- **Page text** comes from `pdftotext` (free, local)
- **Page images** are rendered by `pdftoppm` (free, local)
- **Categorization** is done by reading the page-1-line headers, not by reading the slides

This makes adding a new PDF gallery cheap — a 200-page MEB textbook is ~2 minutes of Claude time + a few hundred tokens.

---

## Gotchas & lessons learned

1. **Don't trust `encodeURI()` for arbitrary filenames.** Pre-encode in Python (`urllib.parse.quote(safe='')`).
2. **GitHub Pages serves from `/tmp/ehliyet-pratik` clone — `/tmp` gets wiped between sessions.** Re-clone if the directory's gone before pushing.
3. **Don't `git add pics/` from the source repo `/Users/musab/Desktop/custom code/driving/`** — that source repo has no `origin` and the staged files go nowhere useful. Always work in the cloned `/tmp/ehliyet-pratik`.
4. **`.DS_Store` on macOS** sneaks into the repo. Delete before `git add`.
5. **Cache-busting:** the deployed `index.html` files don't have a `?v=` cache-bust on the data because the data is embedded inline. If you ever extract DATA into a separate `.js`, add `?v=<count>` per CLAUDE.md § 10.
6. **Render at 110 DPI, not 150.** 3× the size for marginal sharpness gain.
7. **Group categories around your existing notes numbering** — that's the user's mental model. Don't invent a new taxonomy.

---

## File layout

```
pics/
├── PIPELINE.md                         ← this file
├── index.html                          ← personal screenshots gallery + index of all 3
│
├── trafik lesson 1 - apr 15/           ← raw screenshot folders (3 lessons)
├── vehicle info part 1/
├── vehicle info part 2/
│
├── trafik-ders-kitabi/                 ← Trafik ve Çevre PDF gallery
│   ├── index.html
│   ├── 01-tanimlar/                    (29 PNGs)
│   ├── 02-trafik-gorevlisi-isiklar/    (15)
│   ├── 03-trafik-isaret-levhalari/     (20)
│   ├── 04-yol-cizgileri/               (10)
│   ├── 05-alkol-yasaklar-mesleki/      (5)
│   ├── 06-karayolu-hiz-mesafe/         (8)
│   ├── 07-gecme-manevralar/            (8)
│   ├── 08-kavsak-ilk-gecis/            (16)
│   ├── 09-gecis-ustunlugu-kolayligi/   (7)
│   ├── 10-durma-park-isiklandirma/     (9)
│   ├── 11-yukleme-yolcu-tehlikeli/     (7)
│   ├── 12-bisiklet-motosiklet-yaya/    (11)
│   ├── 13-trafik-kazalari-cezalar/     (8)
│   └── 14-tescil-belge-cevre-psikoloji/(26)
│
└── arac-teknigi-kitabi/                ← Araç Tekniği PDF gallery
    ├── index.html
    ├── 01-motor-genel/                 (13)
    ├── 02-atesleme-aku/                (6)
    ├── 03-yakit-sistemi/               (6)
    ├── 04-yaglama-sistemi/             (2)
    ├── 05-sogutma-hararet/             (5)
    ├── 06-sarj-mars/                   (5)
    ├── 07-egzoz-aydinlatma-gosterge/   (7)
    ├── 08-guc-aktarma-lastik/          (6)
    ├── 09-fren-suspansiyon-direksiyon/ (6)
    └── 10-rodaj-bakim-tasarruf/        (5)
```

---

## Coverage gaps (PDFs vs your existing notes)

Use this to prioritize which `ders-notes/*.md` files to write next.

### `e-tusekon-portal/ders-notes/trafik-ve-çevre/`
You have notes 01–24. The PDF gallery exposes ~45 slides not yet covered:

- **Bisiklet, Motosiklet & Yayalar** (gallery cat 12 — 11 slides)
- **Trafik Kazaları, Cezalar & Sigorta** (cat 13 — 8 slides)
- **Tescil, Muayene, Sürücü Belgeleri, Çevre & Trafik Psikolojisi** (cat 14 — 26 slides)

### `e-tusekon-portal/ders-notes/araç-tekniği/`
You have notes 01–13 (with gaps at 06, 07). The PDF gallery exposes:

- **Soğutma Sistemi & Hararet** (cat 05 — 5 slides) — not yet in notes (this is "06" in the slide deck's logical order)
- **Egzoz Sistemi** — bundled into cat 07 — only 1 slide but exam-relevant
- **Rodaj & Bakım** — bundled into cat 10 — 2 slides
