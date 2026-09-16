/**
 * Server vocabularies said the way the yard says them. Kept in one place so a
 * part reads the same on its own screen, in the scanner and in a list.
 */
export const conditionLabel = (value: string) =>
  ({
    new: 'Нова',
    used: 'Вживана',
    good: 'б/в',
    fair: 'Задовільна',
    scrap: 'Під відновлення',
    refurbished: 'Відновлена',
    damaged: 'Пошкоджена',
  })[value] ?? value

export const sourceLabel = (value: string) =>
  ({ car: 'Авто', batch: 'Приймання', free: 'Без джерела' })[value] ?? value

export const originLabel = (id: string, name: string) =>
  (({ car: 'З авто', batch: 'З партії', free: 'Вільна' })[id] ?? name) || id

/** Event names from the part history, in plain words. */
export const historyLabel = (value: string) =>
  ({
    created: 'Створено',
    updated: 'Змінено',
    edited: 'Змінено',
    reserved: 'Зарезервовано',
    released: 'Резерв знято',
    sold: 'Продано',
    returned: 'Повернено',
    moved: 'Переміщено',
    placed: 'Розміщено',
    unplaced: 'Знято з місця',
    deleted: 'Видалено',
  })[value] ?? value
