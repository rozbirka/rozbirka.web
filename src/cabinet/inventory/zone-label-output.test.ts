import { expect, it, vi } from 'vitest'
import { buildZoneLabelHtml } from './zone-label-output'

const qr = vi.hoisted(() => ({ toString: vi.fn() }))

vi.mock('qrcode', () => ({ default: qr }))

it('encodes the raw zone code and renders a thermal-label print sheet', async () => {
  qr.toString.mockResolvedValue('<svg>zone</svg>')

  const html = await buildZoneLabelHtml([
    {
      id: 'zone-1',
      qrCode: 'ZONE-1',
      zoneName: 'A < 1',
      zoneCode: 'A1',
      warehouseName: 'Основний',
    },
  ])

  expect(qr.toString).toHaveBeenCalledWith(
    'ZONE-1',
    expect.objectContaining({ type: 'svg', errorCorrectionLevel: 'M' }),
  )
  expect(html).toContain('@page { size: 40mm 58mm; margin: 0; }')
  expect(html).toContain('A &lt; 1')
  expect(html).toContain('<svg>zone</svg>')
})

it('prints label text in the given document language', async () => {
  qr.toString.mockResolvedValue('<svg>zone</svg>')
  const zone = {
    id: 'zone-1',
    qrCode: 'ZONE-1',
    zoneName: 'A1',
    zoneCode: 'A1',
    warehouseName: 'Main',
  }

  const uk = await buildZoneLabelHtml([zone])
  expect(uk).toContain('<html lang="uk">')
  expect(uk).toContain('<title>QR-етикетки зон</title>')
  expect(uk).toContain('aria-label="QR зони A1"')

  const english = await buildZoneLabelHtml([zone], 'en-GB')
  expect(english).toContain('<html lang="en-GB">')
  expect(english).toContain('<title>Zone QR labels</title>')
  expect(english).toContain('aria-label="Zone QR A1"')

  const polish = await buildZoneLabelHtml([zone], 'pl')
  expect(polish).toContain('<title>Etykiety QR stref</title>')
})
