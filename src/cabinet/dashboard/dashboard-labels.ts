/**
 * What the server calls the last thing that happened, said in Ukrainian. An
 * unknown code falls through as itself rather than disappearing — a new server
 * event should be visible, not silently blank.
 */
export const activityLabel = (type: string) =>
  ({
    part_created: 'Додано запчастину',
    car_created: 'Додано автомобіль',
    intake_created: 'Створено приймання',
    sale: 'Продаж',
  })[type] ?? type
