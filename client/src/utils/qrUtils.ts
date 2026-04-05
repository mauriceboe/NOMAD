import type { PackingItem } from '../types'

interface QrPackingItem {
  n: string
  q?: number
}

interface QrPackingData {
  t: 'p' // Type identifier for packing lists
  c: string // Category name
  i: QrPackingItem[] // Items
}

export function encodePackingList(categoryName: string, items: PackingItem[]): string {
  const data: QrPackingData = {
    t: 'p',
    c: categoryName,
    i: items.map(item => {
      const qrItem: QrPackingItem = { n: item.name }
      if (item.quantity && item.quantity > 1) {
        qrItem.q = item.quantity
      }
      return qrItem
    })
  }
  return JSON.stringify(data)
}

export function decodePackingList(jsonString: string): { category: string, items: Partial<PackingItem>[] } {
  let data: QrPackingData
  try {
    data = JSON.parse(jsonString)
  } catch (error) {
    throw new Error('Failed to parse QR code data')
  }
    
  // Validate format
  if (data.t !== 'p' || !data.c || !Array.isArray(data.i)) {
    throw new Error('Invalid QR code format for packing list')
  }

  const category = data.c
  const items: Partial<PackingItem>[] = data.i.map(qrItem => ({
    name: qrItem.n,
    category: category,
    quantity: qrItem.q || 1,
    checked: 0
  }))

  return { category, items }
}
