import { expect, it } from 'vitest'
import { featureLabel } from './billing-vocabulary'

it('shows the QR code feature in Ukrainian', () => {
  expect(featureLabel('qr_codes')).toBe('QR-коди')
})
