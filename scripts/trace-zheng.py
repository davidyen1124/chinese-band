"""Trace the rims and the curved front bridge (岳山) in the generated guzheng photos.

Prints the geometry used by src/lib/zhengArt.ts and writes the web assets:
the end photos, a seamless soundboard fill tile for each, and the rotated
"upright" variant for phones held sideways.

usage: python scripts/trace-zheng.py <portrait.png> <landscape.png> <out-dir>
"""
import json
import sys
from PIL import Image, ImageOps

STRINGS = 21


def lum(p):
    r, g, b = p[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def is_bone(p):
    r, g, b = p[:3]
    # Ivory/bone: bright and low saturation.
    return lum(p) > 185 and max(r, g, b) - min(r, g, b) < 70


def rims(im):
    """First and last rows of the soundboard, sampled across its plain middle."""
    w, h = im.size
    px = im.load()
    xs = [int(w * f) for f in (0.08, 0.2, 0.32, 0.44)]
    rows = [sum(lum(px[x, y]) for x in xs) / len(xs) for y in range(h)]
    board = sorted(rows[int(h * 0.4) : int(h * 0.6)])[len(rows[int(h * 0.4) : int(h * 0.6)]) // 2]
    # The rim is darker than the board, with a bright inlay line at its inner edge.
    top = next(y for y in range(int(h * 0.02), h // 2) if abs(rows[y] - board) < 14 and all(abs(rows[y + k] - board) < 18 for k in range(6)))
    bottom = next(y for y in range(h - int(h * 0.02), h // 2, -1) if abs(rows[y] - board) < 14 and all(abs(rows[y - k] - board) < 18 for k in range(6)))
    return top, bottom


def bone_x(im, y):
    """Left edge of the bone strip on row y, searching the right half."""
    w, _ = im.size
    px = im.load()
    for x in range(int(w * 0.5), w - 2):
        if is_bone(px[x, y]) and is_bone(px[x + 1, y]) and is_bone(px[x + 2, y]):
            return x
    return None


def trace(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    top, bottom = rims(im)
    # Keep the outer strings a little clear of the rims.
    pad = (bottom - top) * 0.035
    a, b = top + pad, bottom - pad
    step = (b - a) / STRINGS
    ends = []
    for i in range(STRINGS):
        y = int(a + (i + 0.5) * step)
        xs = [bone_x(im, yy) for yy in range(y - 2, y + 3)]
        xs = [x for x in xs if x is not None]
        x = sorted(xs)[len(xs) // 2]
        ends.append(round(w - x + 2))
    return im, {'across': h, 'rimA': round(a), 'rimB': round(h - b), 'ends': ends, 'w': w}


def fill_tile(im, frac=0.26):
    """A seamless tile of plain soundboard: a left slice, then its mirror image.

    The tile's right edge is the photo's own left edge, so it continues the
    photo without a seam, and repeats seamlessly to the left of that.
    """
    w, h = im.size
    part = im.crop((0, 0, int(w * frac), h))
    tile = Image.new('RGB', (part.width * 2, h))
    tile.paste(part, (0, 0))
    tile.paste(ImageOps.mirror(part), (part.width, 0))
    return tile


def main():
    portrait, landscape, out = sys.argv[1:4]
    geo = {}
    for name, path in (('portrait', portrait), ('landscape', landscape)):
        im, g = trace(path)
        geo[name] = g
        im.save(f'{out}/zheng-end-{name}.png')
        fill_tile(im).save(f'{out}/zheng-fill-{name}.png')
        if name == 'portrait':
            # Sideways phones: head at the top, lowest string on the left. Height is
            # scarce there, so keep only a sliver of the carved head past the 岳山.
            keep = im.width - min(g['ends']) + 48
            cut = im.width - keep
            short = im.crop((0, 0, keep, im.height))
            short.rotate(90, expand=True).save(f'{out}/zheng-end-upright.png')
            fill_tile(im).rotate(90, expand=True).save(f'{out}/zheng-fill-upright.png')
            geo['upright'] = {**g, 'w': keep, 'ends': [e - cut for e in g['ends']]}
    print(json.dumps(geo))


main()
