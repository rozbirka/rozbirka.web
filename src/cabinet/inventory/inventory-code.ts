/** Match Core's SlugHelper for Ukrainian names entered in inventory forms. */
const cyrillic: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'yu',
  я: 'ya',
}

export function inventoryCodeFromName(name: string): string {
  let code = ''
  for (const char of name.toLowerCase()) {
    if (/[a-z0-9]/.test(char)) code += char
    else if (char in cyrillic) code += cyrillic[char]
    else if (char === 'ł') code += 'l'
    else if (/\s|[-_]/.test(char)) code += '-'
    else
      code += char
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
  }
  return code
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '')
}
