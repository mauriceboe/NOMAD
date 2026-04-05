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

/**
 * Encodes a packing list as a universally readable CSV string.
 * Format: Category,Item Name,Quantity
 */
export function encodePackingList(categoryName: string, items: PackingItem[]): string {
  const escape = (str: string) => `"${str.replace(/"/g, '""')}"`
  
  const header = "Category,Item,Quantity"
  const rows = items.map(item => {
    return `${escape(categoryName)},${escape(item.name)},${item.quantity || 1}`
  })
  
  return [header, ...rows].join('\n')
}

/**
 * Decodes a packing list from either the new CSV format or the legacy JSON format.
 */
export function decodePackingList(dataString: string): { category: string, items: Partial<PackingItem>[] } {
  const trimmed = dataString.trim()
  
  // Try legacy JSON format first
  if (trimmed.startsWith('{')) {
    try {
      const data: QrPackingData = JSON.parse(trimmed)
      if (data.t === 'p' && data.c && Array.isArray(data.i)) {
        const category = data.c
        const items: Partial<PackingItem>[] = data.i.map(qrItem => ({
          name: qrItem.n,
          category: category,
          quantity: qrItem.q || 1,
          checked: 0
        }))
        return { category, items }
      }
    } catch (e) {
      // Not JSON, continue to CSV
    }
  }

  // Robust CSV parser that handles quotes and potential newlines within fields
  const items: Partial<PackingItem>[] = []
  let detectedCategory = 'Imported'
  
  let currentField = ''
  let inQuotes = false
  let currentRow: string[] = []
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    const nextChar = trimmed[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++ // Skip double quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++ // Skip \n after \r
      currentRow.push(currentField.trim())
      
      // Process row
      const isHeader = items.length === 0 && currentRow.some(f => f.toLowerCase().includes('item') || f.toLowerCase().includes('category'))
      if (!isHeader && currentRow.length > 0) {
        if (currentRow.length >= 2) {
          detectedCategory = currentRow[0] || detectedCategory
          items.push({
            name: currentRow[1],
            category: detectedCategory,
            quantity: parseInt(currentRow[2], 10) || 1,
            checked: 0
          })
        } else if (currentRow.length === 1 && currentRow[0]) {
          items.push({
            name: currentRow[0],
            category: detectedCategory,
            quantity: 1,
            checked: 0
          })
        }
      }
      
      currentField = ''
      currentRow = []
    } else {
      currentField += char
    }
  }
  
  // Handle last row if no trailing newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.length >= 2) {
      detectedCategory = currentRow[0] || detectedCategory
      items.push({
        name: currentRow[1],
        category: detectedCategory,
        quantity: parseInt(currentRow[2], 10) || 1,
        checked: 0
      })
    } else if (currentRow.length === 1 && currentRow[0]) {
      items.push({
        name: currentRow[0],
        category: detectedCategory,
        quantity: 1,
        checked: 0
      })
    }
  }

  if (items.length === 0) {
    throw new Error('No items found in QR code')
  }

  return { category: detectedCategory, items }
}
