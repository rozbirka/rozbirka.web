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
      svg: await QRCode.toString(zone.qrCode, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      }),
    })),
  )
  const body = labels
    .map(
      ({ zone, svg }) => `<article class="label">
  <div class="qr" role="img" aria-label="${zone.kind && zone.kind !== 'zone' ? escapeHtml(`${locationText[locale].kinds[zone.kind]} QR ${zone.zoneName}`) : text('qrAlt', zone.zoneName)}">${svg}</div>
  ${zone.kind ? `<span>${escapeHtml(locationText[locale].kinds[zone.kind])}</span>` : ''}
  <strong>${escapeHtml(zone.zoneName)}</strong>
  <span>${escapeHtml(zone.zoneCode)}</span>
  <small>${escapeHtml((zone.path ?? [zone.warehouseName]).join(' · '))}</small>
</article>`,
    )
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
    .label{width:40mm;height:57mm;padding:2mm;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:system-ui,sans-serif;background:#fff;color:#000;break-after:page}
    .label:last-child{break-after:auto}
    .qr{width:36mm;height:36mm;flex:none;margin-bottom:2mm}
    .qr svg{display:block;width:100%;height:100%}
    strong{max-width:100%;font-size:13px;line-height:1.1;overflow:hidden}
    span{font-size:10px;font-weight:700;margin-top:1mm}
    small{font-size:7px;color:#666;margin-top:auto}
  </style>
</head>
<body>${body}</body>
</html>`
}
