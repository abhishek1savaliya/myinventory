/** Build URL slug from organization name: "Abhishek Water Supplies" → "abhishek-water-supplies" */
export function slugifyOrganizationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Prefix for org code: first letter of each word, padded to 3 letters — "Abhishek Water Supplies" → "AWS" */
export function orgCodePrefixFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  let letters = ''

  for (const word of words) {
    const char = word.replace(/[^a-zA-Z]/g, '')[0]
    if (char) {
      letters += char.toUpperCase()
    }
    if (letters.length >= 3) {
      break
    }
  }

  const alpha = name.replace(/[^a-zA-Z]/g, '').toUpperCase()
  let index = letters.length

  while (letters.length < 3 && index < alpha.length) {
    letters += alpha[index]
    index += 1
  }

  while (letters.length < 3) {
    letters += 'X'
  }

  return letters.slice(0, 3)
}

/** Random 5-digit suffix for org code (10000–99999). */
export function randomOrgCodeSuffix(): string {
  return String(Math.floor(10000 + Math.random() * 90000))
}

export function buildOrgCode(name: string, suffix?: string): string {
  return `${orgCodePrefixFromName(name)}${suffix ?? randomOrgCodeSuffix()}`
}
