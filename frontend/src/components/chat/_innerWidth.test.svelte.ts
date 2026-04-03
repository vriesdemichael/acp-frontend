// @vitest-environment happy-dom
import { it, expect } from 'vitest'
it('window.innerWidth in happy-dom', () => {
  expect(window.innerWidth).toBeGreaterThanOrEqual(0)
  console.log('INNERWIDTH:', window.innerWidth)
})
