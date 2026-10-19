#!/usr/bin/env python3
"""visual_check.py — перевірка HTML-прототипів Rozbirka.

1) Лінт токенів: невідомі var(--*), hex поза tokens.css, font-size поза шкалою, сторонні font-family.
2) Рендер кожного стану (?state=<id> з manifest.json) у Playwright: dark/light × 1440/375.
3) Порівняння з еталоном (reference/<feature>/<state>-<theme>-<w>.png), pixelmatch-поріг.

Використання:
  pip install playwright pillow && playwright install chromium
  python check/visual_check.py lint  path/to/file.html [...]
  python check/visual_check.py shoot --base http://localhost:8000/v2/features/ --out shots/
  python check/visual_check.py diff  --shots shots/ --ref reference/ --threshold 0.02
  python check/visual_check.py update-ref --shots shots/ --ref reference/
"""
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "v2" / "tokens.css"
MANIFEST = ROOT / "v2" / "features" / "manifest.json"
FONT_SCALE = {"11px", "12px", "13px", "14px", "16px", "20px", "28px"}
ALLOWED_FONTS = ("Manrope", "JetBrains Mono", "var(--rz-font", "inherit", "ui-monospace", "ui-sans-serif", "monospace", "sans-serif")
HEX_OK_FILES = {"tokens.css"}

def defined_tokens():
    css = TOKENS.read_text(encoding="utf-8")
    return set(re.findall(r"(--rz-[\w-]+)\s*:", css))

def lint(paths):
    tokens = defined_tokens()
    problems = 0
    for p in map(Path, paths):
        text = p.read_text(encoding="utf-8")
        for m in re.finditer(r"var\((--rz-[\w-]+)", text):
            if m.group(1) not in tokens:
                problems += 1; print(f"{p}:{line(text, m.start())}: невідомий токен {m.group(1)}")
        if p.name not in HEX_OK_FILES:
            for m in re.finditer(r"#[0-9a-fA-F]{3,8}\b", text):
                ctx = text[max(0, m.start()-40):m.start()]
                if "rz-paper" in ctx or "print" in ctx:  # друк дозволяє #fff/#111/#555/#666/#bbb
                    continue
                problems += 1; print(f"{p}:{line(text, m.start())}: hex поза токенами {m.group(0)}")
        for m in re.finditer(r"font-size\s*:\s*([\d.]+px)", text):
            if m.group(1) not in FONT_SCALE:
                problems += 1; print(f"{p}:{line(text, m.start())}: font-size {m.group(1)} поза шкалою 11/12/13/14/16/20/28")
        for m in re.finditer(r"font-family\s*:\s*([^;\"]+)", text):
            if not any(f in m.group(1) for f in ALLOWED_FONTS):
                problems += 1; print(f"{p}:{line(text, m.start())}: сторонній шрифт {m.group(1).strip()}")
    print(f"lint: {problems} проблем")
    return problems

def line(text, idx):
    return text.count("\n", 0, idx) + 1

def shoot(base, out):
    from playwright.sync_api import sync_playwright
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    feats = json.loads(MANIFEST.read_text(encoding="utf-8"))["features"]
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for f in feats:
            for sid, _ in f["states"]:
                for theme in ("dark", "light"):
                    for w, h in ((1440, 900), (375, 812)):
                        page = b.new_page(viewport={"width": w, "height": h})
                        sep = "&" if "?" in f["file"] else "?"
                        page.goto(f"{base}{f['file']}{sep}state={sid}", wait_until="networkidle")
                        page.evaluate(f"document.querySelector('.rz')?.setAttribute('data-theme','{theme}')")
                        page.wait_for_timeout(300)
                        errs = page.evaluate("[...document.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflowX==='visible').length")
                        name = f"{f['id']}-{sid}-{theme}-{w}.png"
                        page.screenshot(path=str(out / name), full_page=True)
                        if errs: print(f"{name}: {errs} елементів з горизонтальним переповненням")
                        page.close()
        b.close()

def diff(shots, ref, threshold):
    from PIL import Image, ImageChops
    shots, ref = Path(shots), Path(ref); bad = 0
    for s in sorted(shots.glob("*.png")):
        r = ref / s.name
        if not r.exists():
            print(f"{s.name}: немає еталона"); continue
        a, b = Image.open(s).convert("RGB"), Image.open(r).convert("RGB")
        if a.size != b.size:
            bad += 1; print(f"{s.name}: розмір {a.size} ≠ {b.size}"); continue
        d = ImageChops.difference(a, b).convert("L").point(lambda x: 255 if x > 24 else 0)
        ratio = sum(d.getdata()) / 255 / (a.size[0] * a.size[1])
        if ratio > threshold:
            bad += 1; print(f"{s.name}: відрізняється {ratio:.2%} > {threshold:.0%}")
    print(f"diff: {bad} невідповідностей"); return bad

def update_ref(shots, ref):
    import shutil
    Path(ref).mkdir(parents=True, exist_ok=True)
    for s in Path(shots).glob("*.png"): shutil.copy(s, Path(ref) / s.name)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("lint"); l.add_argument("files", nargs="+")
    s = sub.add_parser("shoot"); s.add_argument("--base", required=True); s.add_argument("--out", default="shots")
    d = sub.add_parser("diff"); d.add_argument("--shots", default="shots"); d.add_argument("--ref", default="reference"); d.add_argument("--threshold", type=float, default=0.02)
    u = sub.add_parser("update-ref"); u.add_argument("--shots", default="shots"); u.add_argument("--ref", default="reference")
    a = ap.parse_args()
    if a.cmd == "lint": sys.exit(1 if lint(a.files) else 0)
    if a.cmd == "shoot": shoot(a.base, a.out)
    if a.cmd == "diff": sys.exit(1 if diff(a.shots, a.ref, a.threshold) else 0)
    if a.cmd == "update-ref": update_ref(a.shots, a.ref)
