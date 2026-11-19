// An app's own strings, one object per language (README.md §7).
import { useLocale, type Locale } from './locale.js'

/**
 * Returns the hook an app reads its strings with, in the current language:
 * `export const useStrings = createStrings({ en, es })`. Every language this package offers needs
 * an object, so adding one here fails tsc in each app until it has the strings. Declare `es` as
 * `typeof en` (or a `Strings` alias of it), so a key missing from it fails tsc too.
 */
export function createStrings<S>(strings: Record<Locale, S>): () => S {
  return function useStrings(): S {
    return strings[useLocale().locale]
  }
}
