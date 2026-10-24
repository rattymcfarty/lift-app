#!/usr/bin/env python3
"""
Quality gate for the 3D muscle icons.

Every check is objective and printed with its measured value, so "looks fine"
is not part of the process. Exit code is 1 if any icon fails a hard check.

  python3 qa.py chest-body.png chest-mask.png [...]
"""
import sys
from PIL import Image

# thresholds: (low, high); hard = fails the run
# A whole-figure icon is tall and thin inside a square frame: head to feet can
# only fill ~0.17 of it, whereas a cropped muscle icon fills ~0.3-0.6. The floor
# is about "not lost in the frame", so it follows the framing, not the code.
COVERAGE_FLOOR = {"full-body": 0.14, "olympic": 0.14}

CHECKS = {
    "body_coverage": (0.22, 0.90, False),  # fraction of the tile the figure fills
    "mask_ratio": (0.03, 0.62, True),      # muscle area / body area
    "mask_outside": (0.0, 0.002, True),    # muscle pixels with no body under them
    "soft_edge": (0.25, 4.0, True),         # mean feather width in px (perimeter-normalised)
    "contrast48": (25.0, 999.0, True),     # RGB distance at 48 px
    "mask_clip": (0.0, 0.005, True),       # muscle cut off by the frame
}


def alpha_frac(img, thr=32):
    a = img.getchannel("A")
    n = sum(1 for v in a.tobytes() if v > thr)
    return n / (img.width * img.height), n


def mean_rgb(img, mask_img=None):
    px = img.convert("RGB").load()
    if mask_img is None:
        return tuple(sum(px[x, y][i] for x in range(img.width) for y in range(img.height)) /
                     (img.width * img.height) for i in range(3))
    m = mask_img.getchannel("A").load()
    tot = [0, 0, 0]
    n = 0
    for y in range(img.height):
        for x in range(img.width):
            if m[x, y] > 128:
                c = px[x, y]
                tot = [tot[i] + c[i] for i in range(3)]
                n += 1
    return tuple(t / max(1, n) for t in tot)


def composite(body, mask, size, hi):
    tile = Image.new("RGBA", (size, size), (28, 28, 30, 255))
    pad = max(1, int(size * 0.04))
    inner = size - pad * 2
    b = body.resize((inner, inner), Image.LANCZOS)
    m = Image.new("RGBA", (inner, inner), hi)
    m.putalpha(mask.resize((inner, inner), Image.LANCZOS).getchannel("A"))
    tile.alpha_composite(b, (pad, pad))
    tile.alpha_composite(m, (pad, pad))
    return tile.convert("RGB")


def difference_mask(body, muscle, lo=0.02, hi=0.06):
    """The painted area, recovered from the rendered colour difference.

    The distance is measured in chromaticity (each channel over that pixel's
    sum), not raw RGB. Raw RGB distance collapses wherever the highlight is
    dark: shadowed purple muscle sits close to grey skin, so a large part of the
    muscle read as a half-tone and the feather metric counted shading. Hue
    survives shadow, so a dark accent and a light one are measured the same way.
    """
    bp = body.load()
    mp = muscle.load()
    out = Image.new("L", body.size, 0)
    op = out.load()
    for y in range(body.height):
        for x in range(body.width):
            if bp[x, y][3] < 32:
                continue
            b, m = bp[x, y], mp[x, y]
            sb, sm = b[0] + b[1] + b[2], m[0] + m[1] + m[2]
            if not sb or not sm:
                continue
            d = max(abs(m[i] / sm - b[i] / sb) for i in range(3))
            op[x, y] = 255 if d > hi else (int((d - lo) / (hi - lo) * 255) if d > lo else 0)
    return out


def check(body_path, mask_path):
    icon_name = body_path.split("/")[-1].replace("-body.png", "")
    body = Image.open(body_path).convert("RGBA")
    mask = Image.open(mask_path).convert("RGBA")
    m = difference_mask(body, mask)
    mask = Image.merge("RGBA", (m, m, m, m))
    res = {}

    res["body_coverage"], body_px = alpha_frac(body)
    mask_px = alpha_frac(mask)[1]
    res["mask_ratio"] = mask_px / max(1, body_px)

    # muscle must sit on the body
    ba = body.getchannel("A").load()
    ma = mask.getchannel("A").load()
    outside = 0
    for y in range(mask.height):
        for x in range(mask.width):
            if ma[x, y] > 128 and ba[x, y] < 32:
                outside += 1
    res["mask_outside"] = outside / max(1, mask_px)

    # Feathered edge, measured as mean width: soft pixels per boundary pixel.
    a = mask.getchannel("A").load()
    solid = [[a[x, y] > 128 for x in range(mask.width)] for y in range(mask.height)]
    edge = 0
    for y in range(1, mask.height - 1):
        row = solid[y]
        up, dn = solid[y - 1], solid[y + 1]
        for x in range(1, mask.width - 1):
            if row[x] and not (row[x - 1] and row[x + 1] and up[x] and dn[x]):
                edge += 1
    soft = sum(1 for v in mask.getchannel("A").tobytes() if 32 < v < 224)
    res["soft_edge"] = soft / max(1, edge)

    # can the muscle still be told apart at 48 px?
    small = composite(body, mask, 48, (160, 115, 240, 255))  # #a073f0, the dark accent
    m48 = Image.new("L", (48, 48), 0)
    a = mask.resize((48, 48), Image.LANCZOS).getchannel("A")
    b = body.resize((48, 48), Image.LANCZOS).getchannel("A")
    # muscle pixels = mask alpha high; body-only = body visible, mask low
    mp, bp = small.load(), b.load()
    ms = [mp[x, y] for y in range(48) for x in range(48) if bp[x, y] > 200 and a.getpixel((x, y)) > 200]
    bs = [mp[x, y] for y in range(48) for x in range(48) if bp[x, y] > 200 and a.getpixel((x, y)) < 40]
    if ms and bs:
        m = [sum(c[i] for c in ms) / len(ms) for i in range(3)]
        b2 = [sum(c[i] for c in bs) / len(bs) for i in range(3)]
        res["contrast48"] = sum((m[i] - b2[i]) ** 2 for i in range(3)) ** 0.5
    else:
        res["contrast48"] = 0.0

    # the muscle must not be cut by the frame
    ring = 0
    edge = [ma[x, y] for x in range(mask.width) for y in (0, mask.height - 1)]
    edge += [ma[x, y] for y in range(mask.height) for x in (0, mask.width - 1)]
    res["mask_clip"] = sum(1 for v in edge if v > 32) / max(1, len(edge))

    fails = []
    for name, (lo, hi, hard) in CHECKS.items():
        v = res[name]
        if name == "body_coverage":
            lo = COVERAGE_FLOOR.get(icon_name, lo)
        if not (lo <= v <= hi):
            fails.append((name, v, lo, hi, hard))
    return res, fails


def main():
    pairs = []
    args = sys.argv[1:]
    for i in range(0, len(args), 2):
        pairs.append((args[i], args[i + 1]))

    hard_fail = False
    for body_path, mask_path in pairs:
        name = body_path.split("/")[-1].replace("-body.png", "")
        res, fails = check(body_path, mask_path)
        status = "PASS"
        if fails:
            status = "FAIL" if any(f[4] for f in fails) else "WARN"
        if status == "FAIL":
            hard_fail = True
        print(f"{status}  {name}")
        for k, v in res.items():
            print(f"      {k:14} {v:.3f}")
        for name_, v, lo, hi, hard in fails:
            print(f"      ! {name_} = {v:.3f} outside {lo}..{hi}{' (hard)' if hard else ''}")
    sys.exit(1 if hard_fail else 0)


if __name__ == "__main__":
    main()
