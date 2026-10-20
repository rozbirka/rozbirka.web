import QRCode from 'qrcode'
import { SOURCE_LOCALE, translate, type Locale } from '@/i18n'
import { zoneLabelMessages } from './zone-label-messages'

export interface PrintableZoneLabel {
  id: string
  qrCode: string
  zoneName: string
  zoneCode: string
  warehouseName: string
  kind?: 'warehouse' | 'zone' | 'section' | 'shelf'
  path?: string[]
}

const locationText: Record<
  Locale,
  {
    title: string
    kinds: Record<NonNullable<PrintableZoneLabel['kind']>, string>
  }
> = {
  uk: {
    title: 'QR-етикетки місць зберігання',
    kinds: {
      warehouse: 'Склад',
      zone: 'Зона',
      section: 'Секція',
      shelf: 'Полиця',
    },
  },
  'en-GB': {
    title: 'Location QR labels',
    kinds: {
      warehouse: 'Warehouse',
      zone: 'Zone',
      section: 'Section',
      shelf: 'Shelf',
    },
  },
  pl: {
    title: 'Etykiety QR lokalizacji',
    kinds: {
      warehouse: 'Magazyn',
      zone: 'Strefa',
      section: 'Sekcja',
      shelf: 'Półka',
    },
  },
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/**
 * Printable zone labels. `locale` is the tenant document language (printed
 * labels do not follow the operator's interface language).
 */
export const buildZoneLabelHtml = async (
  zones: PrintableZoneLabel[],
  locale: Locale = SOURCE_LOCALE,
) => {
  const text = (key: 'documentTitle' | 'qrAlt', name = '') =>
    escapeHtml(translate(zoneLabelMessages, locale, key, { name }))
  const labels = await Promise.all(
    zones.map(async (zone) => ({
      zone,
      svg: (
        await QRCode.toString(zone.qrCode, {
          type: 'svg',
          errorCorrectionLevel: 'H',
          margin: 0,
        })
      ).replace(/\s(width|height)="[^"]*"/g, ''),
    })),
  )
  const body = labels
    .map(({ zone, svg }) => {
      const path = zone.path ?? [zone.warehouseName]

      return `<article class="label">
  <div class="qr" role="img" aria-label="${zone.kind && zone.kind !== 'zone' ? escapeHtml(`${locationText[locale].kinds[zone.kind]} QR ${zone.zoneName}`) : text('qrAlt', zone.zoneName)}">${svg}</div>
  <div class="details">
    ${zone.kind ? `<span class="kind">${escapeHtml(locationText[locale].kinds[zone.kind])}</span>` : ''}
    <strong>${escapeHtml(zone.zoneName)}</strong>
    <span class="code">${escapeHtml(zone.zoneCode)}</span>
    <small>${escapeHtml(path.join(' · '))}</small>
  </div>
</article>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${zones.some((zone) => zone.kind && zone.kind !== 'zone') ? escapeHtml(locationText[locale].title) : text('documentTitle')}</title>
  <style>
    @page { size: 40mm 58mm; margin: 0; }
    html,body{margin:0;padding:0}
    *{box-sizing:border-box}
    .label{width:40mm;height:57mm;padding:2mm;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:"Manrope",ui-sans-serif,sans-serif;background:#fff;color:#000;break-after:page;overflow:hidden}
    .label:last-child{break-after:auto}
    .qr{width:33mm;height:33mm;flex:none;margin-bottom:1mm}
    .qr svg{display:block;width:100%;height:100%}
    .details{width:100%;min-height:0;flex:1;display:flex;flex-direction:column;align-items:center;gap:.5mm}
    .kind{font-size:8px;line-height:1.1;font-weight:700}
    strong{max-width:100%;font-size:13px;line-height:1.1;overflow-wrap:anywhere;flex:none}
    .code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;line-height:1.1;font-weight:700;overflow-wrap:anywhere}
    small{font-size:7px;line-height:1.15;color:#666;overflow-wrap:anywhere;margin-top:auto}
  </style>
</head>
<body>${body}</body>
</html>`
}
