# Part Search Picker Design

## Goal

Provide one reusable dropdown picker for selecting parts outside the main Parts screen.

## Scope

- Replace the part picker in new-order and add-order-item flows.
- Do not change the main Parts screen.
- Do not change the Stickers screen because its list is not a dropdown picker.

## Behavior

- Search by part name, article/external code, or QR code.
- Open the dropdown on focus and while typing.
- Show All, Available, and Reserved filters with result counts.
- Paginate inside the dropdown with 6 or 12 rows per page.
- Selecting a row writes the part name into the search input and closes the dropdown.
- Preserve keyboard and screen-reader semantics for search, filters, rows, and pagination.

## Row design

- Initials tile, part name, status pill, vehicle context, and external code appear in the mockup hierarchy.
- Show the effective USD sale price when the detail endpoint provides one.
- Show an em dash when the price is null or unavailable.
- Use responsive wrapping without overlapping text or controls.
