import type { ImportField, ImportMapping } from '@/api/part-imports'
export const fieldLabels: Record<string, string> = {
  Name: 'Назва',
  Quantity: 'Кількість',
  DesiredSalePrice: 'Ціна за одиницю',
  ExternalCode: 'Артикул',
  OemCode: 'OEM-код',
  PartType: 'Тип деталі',
  Unit: 'Одиниця виміру',
  Notes: 'Примітка',
  Condition: 'Стан',
  SourceType: 'Походження',
  CarId: 'Автомобіль',
  IntakeId: 'Партія',
  InventoryZoneId: 'Складська зона',
  EquipmentTypeId: 'Тип техніки',
  MakeId: 'Марка',
  ModelId: 'Модель',
  GenerationId: 'Покоління',
  YearFrom: 'Рік від',
  YearTo: 'Рік до',
  CarBrand: 'Марка (текст)',
  CarModel: 'Модель (текст)',
  Strategy: 'Сценарій',
  CustomerId: 'Клієнт',
  ReserveQuantity: 'Кількість у резерві',
  ReservePrice: 'Ціна резерву',
  OrderNotes: 'Примітка замовлення',
  OrderGroupKey: 'Група замовлення',
  PhotoKeys: 'Підготовлені фото',
}
export const valueLabels: Record<string, string> = {
  Available: 'Доступні',
  Reserved: 'Резерв',
  free: 'Без автомобіля / партії',
  car: 'З автомобіля',
  batch: 'З партії',
  good: 'Добрий',
  fair: 'Задовільний',
  scrap: 'На утилізацію',
  new: 'Новий',
  refurbished: 'Відновлений',
}
export const statusLabels: Record<string, string> = {
  Uploading: 'Завантаження',
  Uploaded: 'Аналіз',
  Analyzing: 'Аналіз',
  NeedsReview: 'Підготовка',
  Ready: 'Готовий до запуску',
  Queued: 'У черзі',
  Running: 'Виконується',
  CancelRequested: 'Зупиняється',
  Cancelled: 'Скасовано',
  Completed: 'Завершено',
  CompletedWithErrors: 'Частково завершено',
  Failed: 'Помилка',
  Expired: 'Строк минув',
}
export const issueLabels: Record<string, string> = {
  SHEET_SELECTION: 'Оберіть аркуш і прочитайте файл ще раз.',
  HIDDEN_ROWS:
    'Файл містить приховані рядки. Перевірте, чи потрібно їх імпортувати.',
  HIDDEN_COLUMNS:
    'Файл містить приховані колонки. Перевірте, чи потрібно їх імпортувати.',
  HEADER_UNUSABLE:
    'Рядок заголовків містить формули або помилки. Оберіть інший рядок.',
  INTEGER: 'Потрібне ціле число',
  DECIMAL: 'Вкажіть точну числову ціну',
  ENUM: 'Оберіть допустиме значення',
  UNACCOUNTED_COLUMN: 'Зіставте або виключіть колонку',
  COMPATIBILITY_REQUIRED: 'Вкажіть сумісність',
  REQUIRED: 'Обов’язкове поле',
  INVALID_INTEGER: 'Кількість має бути цілим числом',
  INVALID_NUMBER: 'Некоректне число',
  DUPLICATE_DECISION_REQUIRED: 'Можливий дублікат',
  REFERENCE_NOT_FOUND: 'Значення недоступне',
  FORBIDDEN: 'Недостатньо прав',
  STALE_REVISION: 'Дані змінилися. Оновіть імпорт і повторіть перевірку.',
  CONFIRMATION_STALE: 'Підтвердження застаріло. Перевірте дані ще раз.',
  STALE_PREVIEW: 'Перегляд застарів. Оновіть імпорт.',
  IMPORT_DISABLED: 'Імпорт поки недоступний.',
  EXPIRED: 'Строк зберігання минув.',
  FILE_LIMIT: 'Файл перевищує дозволений розмір.',
}
export function createMapping(
  schemaVersion: number,
  version: number,
  fields: ImportField[],
  columns: Record<string, string>,
  constants: Record<string, string>,
  previous: ImportMapping['rules'],
  skippedSources: string[] = [],
): ImportMapping {
  const rules = fields.flatMap((f) => {
    const source = columns[f.id]
    const constant = constants[f.id]
    if (source) return [{ target: f.id, sources: [source] }]
    if (constant?.trim())
      return [{ target: f.id, sources: [], constant: constant.trim() }]
    const old = previous.find((r) => r.target === f.id)
    return old ? [old] : []
  })
  return {
    version: version + 1,
    schemaVersion,
    rules,
    skippedFields: skippedSources.filter(
      (id) => !rules.some((rule) => rule.sources.includes(id)),
    ),
  }
}
export function mayConfirm(
  v: {
    revision: number
    previewVersion: number
    digest: string | null
    invalidCount: number
    selectedCount: number
  } | null,
  revision: number,
  preview: number,
  selected: string[],
  validated: string[],
) {
  return (
    !!v?.digest &&
    v.invalidCount === 0 &&
    v.revision === revision &&
    v.previewVersion === preview &&
    selected.length > 0 &&
    v.selectedCount === selected.length &&
    selected.length === validated.length &&
    [...selected].sort().every((id, i) => id === [...validated].sort()[i])
  )
}
export const isActiveImport = (status: string) =>
  [
    'Uploading',
    'Uploaded',
    'Analyzing',
    'Queued',
    'Running',
    'CancelRequested',
  ].includes(status)
export const issueText = (code: string) =>
  issueLabels[code] ?? `Потребує перевірки (${code})`

/**
 * Cyrillic text saved as Windows-1251 and then read as UTF-8 does not fail —
 * it succeeds into nonsense, and the file looks imported until someone reads
 * the names. The giveaway is the character range: every byte lands in the
 * Latin-1 supplement (À-ÿ, ³, ¿) and no Cyrillic letter survives.
 *
 * This is a guess, not a verdict, and the screen says so. It exists because
 * the alternative — the operator noticing on their own — happens after the
 * import, not before it.
 */
export function looksMisdecoded(values: readonly (string | null)[]) {
  const text = values.filter(
    (value): value is string => value !== null && /[^\d\s.,-]/.test(value),
  )
  if (text.length === 0) return false
  const suspicious = text.filter((value) => {
    const letters = [...value].filter((char) => /\p{L}/u.test(char))
    if (letters.length < 3) return false
    const cyrillic = letters.filter((char) => /\p{Script=Cyrillic}/u.test(char))
    const latin1 = letters.filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code >= 0x00a1 && code <= 0x00ff
    })
    return cyrillic.length === 0 && latin1.length / letters.length > 0.5
  })
  return suspicious.length / text.length > 0.5
}
