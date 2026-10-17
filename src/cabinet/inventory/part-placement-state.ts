import type {
  InventorySection,
  InventoryShelf,
  InventoryZone,
} from '@/api/inventory'

export interface PartPlacement {
  warehouseId: string
  zoneId: string
  sectionId: string
  shelfId: string
}

export const emptyPartPlacement: PartPlacement = {
  warehouseId: '',
  zoneId: '',
  sectionId: '',
  shelfId: '',
}

export interface PlacementOptions {
  zones: InventoryZone[]
  sections: InventorySection[]
  shelves: InventoryShelf[]
  loading: boolean
  error: boolean
  retry: () => void
}
