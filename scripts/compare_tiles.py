#!/usr/bin/env python3
"""Side-by-side tile comparison of a native screenshot against the web prototype.

Full-page screenshots are too dense for careful visual review, so this cuts both
images into matching tiles (a grid, or named component regions) and writes one
PNG per tile with REFERENCE on the left and NATIVE on the right, upscaled 2x.

  python3 scripts/compare_tiles.py REF.png NATIVE.png OUTDIR [--grid 3x3] [--region name:x,y,w,h ...]

Named regions use the 1440x900 layout of both apps, for example:
  --region sidebar:0,0,272,900 --region composer:300,740,760,160
Without --region, a grid is used. Both images are resized to the reference size first.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

LABEL_H = 22


def tile_pair(ref, nat, box, scale):
    a = ref.crop(box)
    b = nat.crop(box)
    w, h = a.size
    w2, h2 = int(w * scale), int(h * scale)
    a = a.resize((w2, h2), Image.LANCZOS)
    b = b.resize((w2, h2), Image.LANCZOS)
    out = Image.new("RGB", (w2 * 2 + 12, h2 + LABEL_H), (128, 128, 128))
    out.paste(a, (0, LABEL_H))
    out.paste(b, (w2 + 12, LABEL_H))
    d = ImageDraw.Draw(out)
    d.text((6, 5), f"REFERENCE {box}", fill=(255, 255, 255))
    d.text((w2 + 18, 5), "NATIVE", fill=(255, 255, 255))
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("ref", type=Path)
    p.add_argument("native", type=Path)
    p.add_argument("out", type=Path)
    p.add_argument("--grid", default="3x3", help="COLSxROWS")
    p.add_argument("--region", action="append", default=[], help="name:x,y,w,h")
    p.add_argument("--scale", type=float, default=2.0)
    a = p.parse_args()
    ref = Image.open(a.ref).convert("RGB")
    nat = Image.open(a.native).convert("RGB").resize(ref.size, Image.LANCZOS)
    a.out.mkdir(parents=True, exist_ok=True)
    jobs = []
    if a.region:
        for spec in a.region:
            name, nums = spec.split(":")
            x, y, w, h = (int(v) for v in nums.split(","))
            jobs.append((name, (x, y, x + w, y + h)))
    else:
        cols, rows = (int(v) for v in a.grid.lower().split("x"))
        tw, th = ref.width // cols, ref.height // rows
        for r in range(rows):
            for c in range(cols):
                jobs.append((f"r{r}c{c}", (c * tw, r * th, (c + 1) * tw, (r + 1) * th)))
    for name, box in jobs:
        path = a.out / f"{name}.png"
        tile_pair(ref, nat, box, a.scale).save(path)
        print(path)


if __name__ == "__main__":
    main()
