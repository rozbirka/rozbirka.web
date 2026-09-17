// Same vehicle catalog and make formatting as the mobile car form.
const base = 'https://vpic.nhtsa.dot.gov/api/vehicles'
export interface CarCatalogItem {
  id: number
  name: string
}
const cache = new Map<string, CarCatalogItem[]>()
const acronyms = new Set([
  'BMW',
  'GMC',
  'MG',
  'BYD',
  'JAC',
  'FAW',
  'GAZ',
  'UAZ',
  'ZAZ',
  'VAZ',
  'RAM',
  'SRT',
])
const makeName = (value: string) =>
  acronyms.has(value.toUpperCase())
    ? value.toUpperCase()
    : value
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ')
async function load(
  path: string,
  kind: 'make' | 'model',
  signal?: AbortSignal,
): Promise<CarCatalogItem[]> {
  const cached = cache.get(path)
  if (cached) return cached
  const timeout = AbortSignal.timeout(15000)
  const response = await fetch(`${base}/${path}?format=json`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new Error('Не вдалося завантажити каталог автомобілів.')
  const payload = (await response.json()) as {
    Results?: Record<string, unknown>[]
  }
  if (!Array.isArray(payload.Results))
    throw new Error('Некоректна відповідь каталогу автомобілів.')
  const items = payload.Results.map((row) => {
    const id = row[kind === 'make' ? 'MakeId' : 'Model_ID']
    const name = row[kind === 'make' ? 'MakeName' : 'Model_Name']
    if (typeof id !== 'number' || typeof name !== 'string')
      throw new Error('Некоректна відповідь каталогу автомобілів.')
    return { id, name: kind === 'make' ? makeName(name) : name }
  }).sort((a, b) => a.name.localeCompare(b.name))
  cache.set(path, items)
  return items
}
export const carCatalogApi = {
  getMakes: (signal?: AbortSignal) =>
    load('GetMakesForVehicleType/car', 'make', signal),
  getModels: (makeId: number, signal?: AbortSignal) =>
    load(`GetModelsForMakeId/${makeId}`, 'model', signal),
}
