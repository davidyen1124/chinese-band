/**
 * Geometry traced from the generated guzheng photographs, in image pixels.
 * `across` is the photo's size across the strings (rim to rim), `rimA`/`rimB`
 * the inset of the first and last string from each edge, and `ends[i]` how far
 * string i stops short of the head end, where it meets the curved 岳山.
 * Regenerate with scripts/trace-zheng.py when the photos change.
 */
export type ZhengArt = {
  src: string
  fill: string
  /** Size across the strings (rim to rim) and along them, in image pixels. */
  across: number
  w: number
  rimA: number
  rimB: number
  ends: number[]
}

const base = import.meta.env.BASE_URL
export const zhengArt: Record<'portrait' | 'landscape' | 'upright', ZhengArt> = {
  portrait: {
    src: `${base}images/zheng-end-portrait.webp`,
    fill: `${base}images/zheng-fill-portrait.webp`,
    across: 1536,
    w: 1024,
    rimA: 113,
    rimB: 136,
    ends: [339, 325, 314, 305, 300, 297, 298, 302, 308, 316, 325, 336, 346, 355, 361, 363, 362, 357, 349, 338, 326],
  },
  landscape: {
    src: `${base}images/zheng-end-landscape.webp`,
    fill: `${base}images/zheng-fill-landscape.webp`,
    across: 1024,
    w: 1536,
    rimA: 91,
    rimB: 123,
    ends: [383, 372, 361, 349, 338, 330, 324, 322, 323, 327, 335, 347, 359, 371, 381, 390, 397, 402, 405, 405, 404],
  },
  upright: {
    src: `${base}images/zheng-end-upright.webp`,
    fill: `${base}images/zheng-fill-upright.webp`,
    across: 1536,
    w: 775,
    rimA: 113,
    rimB: 136,
    ends: [90, 76, 65, 56, 51, 48, 49, 53, 59, 67, 76, 87, 97, 106, 112, 114, 113, 108, 100, 89, 77],
  },
}
