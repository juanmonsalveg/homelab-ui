import { createTheme } from '@mantine/core'
import { brandColors } from './colors.js'

/**
 * The theme every homelab app shares (README.md §6). Fonts, spacing and the dark palette stay
 * Mantine's defaults; Mantine's font stack is the system UI font, so nothing is downloaded.
 */
export const homelabTheme = createTheme({
  colors: { brand: brandColors },
  primaryColor: 'brand',
  defaultRadius: 'md',
})
