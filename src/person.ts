// How a person is drawn in every homelab app (README.md §6). PersonAvatar uses it.

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * The letter an avatar shows: the name's first, so A for both Ana and Ana María. Two letters
 * (Mantine's own initials, AN and AM) don't fit overlapping avatars: the next one covers the second.
 * It's a whole letter even when its accent is a separate code point.
 */
export function initial(name: string, locale: string): string {
  const first = graphemes.segment(name.trim())[Symbol.iterator]().next()
  return first.done ? '' : first.value.segment.toLocaleUpperCase(locale)
}
