import { expect, it } from 'vitest'
import {
  buildStickerHtml,
  buildStickerSvg,
  stickerResumeUrl,
} from './sticker-output'

it('builds a stable own-origin resume URL with the QR code as one encoded path segment', () => {
  expect(stickerResumeUrl('part/QR ?1', 'https://app.example')).toBe(
    'https://app.example/scan/part%2FQR%20%3F1',
  )
})

it('encodes the resume URL as real SVG QR markup for preview and printable HTML', async () => {
  const resumeUrl = stickerResumeUrl('QR-1', 'https://app.example')
  const svg = await buildStickerSvg(resumeUrl)
  expect(svg).toMatch(/^<svg[^>]+>/)
  expect(svg).toContain('<path')

  const html = await buildStickerHtml(
    [
      {
        id: 'part-1',
        name: 'Front <bumper>',
        qrCode: 'QR-1',
        quantity: 1,
        carLabel: 'Ford & Focus',
      },
    ],
    'https://app.example',
  )
  expect(html).toContain(resumeUrl)
  expect(html).toContain('<svg')
  expect(html).toContain('Front &lt;bumper&gt;')
  expect(html).not.toContain('Front <bumper>')
})

it('prints every sticker copy on its own 40 by 58 millimetre page', async () => {
  const html = await buildStickerHtml(
    [
      {
        id: 'part-1',
        name: 'Bumper',
        qrCode: 'QR-1',
        quantity: 2,
        carLabel: 'Ford Focus',
      },
    ],
    'https://app.example',
  )

  expect(html.match(/<article class="sticker">/g)).toHaveLength(2)
  expect(html).toContain('@page{size:40mm 58mm;margin:0}')
  expect(html).toContain('width:40mm;height:57mm')
  expect(html).toContain('page-break-after:always')
  expect(html).toContain(
    '.sticker:last-child{page-break-after:auto;break-after:auto}',
  )
  expect(html).not.toContain('grid-template-columns:repeat(3,1fr)')
})
