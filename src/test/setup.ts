import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Tests never reach the internet: the day's exchange rates, the one thing the app fetches, are offline here
vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Offline in tests'))))

afterEach(() => {
  vi.mocked(fetch).mockClear()
  cleanup()
  localStorage.clear()
})
