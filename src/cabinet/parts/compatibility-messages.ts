import { defineMessages } from '@/i18n'

/** Problems with the vehicles a part is said to fit. */
export const compatibilityMessages = defineMessages({
  uk: {
    chooseMake: 'Оберіть марку.',
    yearRange: 'Рік — чотири цифри від {min} до {max}.',
    unknownBrands: {
      one: 'У довіднику розбірки немає марки: {brands}. Сумісність за нею не збережеться — приберіть цей рядок або оберіть іншу марку.',
      few: 'У довіднику розбірки немає марок: {brands}. Сумісність за ними не збережеться — приберіть ці рядки або оберіть іншу марку.',
      many: 'У довіднику розбірки немає марок: {brands}. Сумісність за ними не збережеться — приберіть ці рядки або оберіть іншу марку.',
      other:
        'У довіднику розбірки немає марок: {brands}. Сумісність за ними не збережеться — приберіть ці рядки або оберіть іншу марку.',
    },
  },
  'en-GB': {
    chooseMake: 'Choose a make.',
    yearRange: 'Year must be four digits from {min} to {max}.',
    unknownBrands: {
      one: 'Your business’s catalogue has no make called {brands}. Compatibility with it won’t be saved — remove this row or choose another make.',
      other:
        'Your business’s catalogue has no makes called {brands}. Compatibility with them won’t be saved — remove these rows or choose another make.',
    },
  },
  pl: {
    chooseMake: 'Wybierz markę.',
    yearRange: 'Rok to cztery cyfry od {min} do {max}.',
    unknownBrands: {
      one: 'W katalogu firmy nie ma marki: {brands}. Kompatybilność z nią nie zostanie zapisana — usuń ten wiersz lub wybierz inną markę.',
      few: 'W katalogu firmy nie ma marek: {brands}. Kompatybilność z nimi nie zostanie zapisana — usuń te wiersze lub wybierz inną markę.',
      many: 'W katalogu firmy nie ma marek: {brands}. Kompatybilność z nimi nie zostanie zapisana — usuń te wiersze lub wybierz inną markę.',
      other:
        'W katalogu firmy nie ma marek: {brands}. Kompatybilność z nimi nie zostanie zapisana — usuń te wiersze lub wybierz inną markę.',
    },
  },
})
