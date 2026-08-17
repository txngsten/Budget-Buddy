/** Colour helpers for charts. */

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null

  let raw = m[1]
  if (raw.length === 3) raw = raw.split('').map(c => c + c).join('')

  const r = parseInt(raw.slice(0, 2), 16) / 255
  const g = parseInt(raw.slice(2, 4), 16) / 255
  const b = parseInt(raw.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Spread `count` slices across shades of `base`, so subcategories that inherit their
 * parent's colour stay in the same family but remain visually distinct.
 * Index 0 gets the base colour; later indices step progressively lighter.
 */
export function shadeColour(base: string, index: number, count: number): string {
  const hsl = hexToHsl(base)
  if (!hsl) return base
  if (count <= 1 || index === 0) return base

  // Walk from the base lightness up toward (but not into) white.
  const ceiling = 0.85
  const span = Math.max(0, ceiling - hsl.l)
  const step = span / Math.max(1, count - 1)
  const l = Math.min(ceiling, hsl.l + step * index)

  // Desaturate slightly as it lightens so the pale end doesn't look neon.
  const s = Math.max(0.25, hsl.s - 0.06 * index)

  return hslToHex({ h: hsl.h, s, l })
}
