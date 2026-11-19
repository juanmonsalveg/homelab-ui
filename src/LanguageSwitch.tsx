import { SegmentedControl, type SegmentedControlItem } from '@mantine/core'
import { useLocale, type Locale } from './locale.js'
import { useUIStrings } from './strings.js'

// Each language is written in itself, so someone who can't read the current one still finds
// theirs, and `lang` lets a screen reader pronounce it.
const languages: SegmentedControlItem<Locale>[] = [
  { value: 'en', label: <span lang="en">English</span> },
  { value: 'es', label: <span lang="es">Español</span> },
]

/** Switches the UI between English and Spanish, and stores the choice on this device (README.md §7). */
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale()
  const t = useUIStrings()

  return (
    <SegmentedControl
      aria-label={t.language}
      size="xs"
      data={languages}
      value={locale}
      onChange={setLocale}
    />
  )
}
