// The homelab colours (README.md §6). Plain values with no imports, so the PWA options (./pwa,
// which run in Node at build time) and an app's icon generator use the same ones as the theme.

/**
 * The brand blue, lightest to darkest. Shade 6, the theme's primary shade in light mode, is the
 * blue of the app icons.
 */
export const brandColors = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
] as const

/** The browser's toolbar colour (the manifest's theme_color and the theme-color meta). */
export const themeColor = brandColors[6]

/** The splash screen behind the icon while the installed app starts: Mantine's light body. */
export const backgroundColor = '#ffffff'
