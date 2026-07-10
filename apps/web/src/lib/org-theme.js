const DEFAULT_THEME_COLOR = '#1e3a5f'
const LIGHT_FOREGROUND = '#111827'
const DARK_FOREGROUND = '#ffffff'

export function parseHexColor(hex) {
  if (!hex) return null

  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function toHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`
}

export function getRelativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function getContrastingForeground(hex, fallback = DARK_FOREGROUND) {
  const rgb = parseHexColor(hex)
  if (!rgb) return fallback

  const luminance = getRelativeLuminance(rgb)
  const contrastWithWhite = (1.05) / (luminance + 0.05)
  const contrastWithBlack = (luminance + 0.05) / 0.05

  return contrastWithWhite >= contrastWithBlack ? DARK_FOREGROUND : LIGHT_FOREGROUND
}

function mixColors(hex, targetHex, targetWeight) {
  const source = parseHexColor(hex)
  const target = parseHexColor(targetHex)
  if (!source || !target) return hex

  const weight = Math.min(1, Math.max(0, targetWeight))
  return toHex(
    source.r * (1 - weight) + target.r * weight,
    source.g * (1 - weight) + target.g * weight,
    source.b * (1 - weight) + target.b * weight,
  )
}

function adjustBrightness(hex, factor) {
  const rgb = parseHexColor(hex)
  if (!rgb) return hex

  return toHex(rgb.r * factor, rgb.g * factor, rgb.b * factor)
}

export function buildOrgThemeStyle(themeColor) {
  const primary = themeColor?.trim() || DEFAULT_THEME_COLOR
  const rgb = parseHexColor(primary)
  if (!rgb) return undefined

  const primaryForeground = getContrastingForeground(primary)
  const isLightPrimary = primaryForeground === LIGHT_FOREGROUND

  return {
    '--color-primary': primary,
    '--color-primary-foreground': primaryForeground,
    '--color-primary-hover': adjustBrightness(primary, isLightPrimary ? 0.9 : 0.85),
    '--color-sidebar': mixColors(primary, '#f4f5f7', 0.94),
    '--color-sidebar-border': mixColors(primary, '#e2e4e9', 0.9),
    '--color-sidebar-active': mixColors(primary, '#ffffff', isLightPrimary ? 0.55 : 0.82),
  }
}

export { DEFAULT_THEME_COLOR }
