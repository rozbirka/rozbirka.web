import { defineMessages } from '@/i18n'

/** Text printed on zone QR labels; follows the tenant document language. */
export const zoneLabelMessages = defineMessages({
  uk: {
    documentTitle: 'QR-етикетки зон',
    qrAlt: 'QR зони {name}',
  },
  'en-GB': {
    documentTitle: 'Zone QR labels',
    qrAlt: 'Zone QR {name}',
  },
  pl: {
    documentTitle: 'Etykiety QR stref',
    qrAlt: 'QR strefy {name}',
  },
})
