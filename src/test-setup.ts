// This package's own Vitest setup. Apps write their own, calling stubBrowserApis (README.md §9).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { stubBrowserApis } from './test.js'

stubBrowserApis()

afterEach(() => {
  cleanup()
  // The language choice lives in localStorage (README.md §7), so each test starts in English.
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})
