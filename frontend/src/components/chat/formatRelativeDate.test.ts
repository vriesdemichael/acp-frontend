import { describe, expect, it } from 'vitest'
import { formatRelativeDate } from './formatRelativeDate.js'

describe('formatRelativeDate', () => {
  const now = new Date('2026-03-21T15:30:00')

  it('returns just now for invalid dates', () => {
    expect(formatRelativeDate('nope', now)).toBe('just now')
  })

  it('formats minutes ago for recent timestamps', () => {
    expect(formatRelativeDate('2026-03-21T15:12:00', now)).toBe('18 minutes ago')
  })

  it('formats hours ago for same-day timestamps', () => {
    expect(formatRelativeDate('2026-03-21T13:10:00', now)).toBe('2 hours ago')
  })

  it('formats yesterday for prior calendar day timestamps', () => {
    expect(formatRelativeDate('2026-03-20T23:50:00', now)).toBe('yesterday')
  })

  it('formats month and day for older dates in the same year', () => {
    expect(formatRelativeDate('2026-02-14T10:00:00', now)).toBe('Feb 14')
  })

  it('formats month, day, and year for older years', () => {
    expect(formatRelativeDate('2025-12-03T10:00:00', now)).toBe('Dec 3, 2025')
  })
})
