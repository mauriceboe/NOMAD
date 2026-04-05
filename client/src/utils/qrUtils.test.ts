import { describe, it, expect } from 'vitest'
import { encodePackingList, decodePackingList } from './qrUtils'
import type { PackingItem } from '../types'

describe('qrUtils', () => {
  const mockItems: PackingItem[] = [
    { id: 1, trip_id: 1, name: 'Passport', category: 'Documents', checked: 0, quantity: 1 },
    { id: 2, trip_id: 1, name: 'T-Shirts', category: 'Clothing', checked: 0, quantity: 5 },
  ]

  it('should encode a packing list correctly', () => {
    const encoded = encodePackingList('Travel', mockItems)
    const data = JSON.parse(encoded)
    
    expect(data.t).toBe('p')
    expect(data.c).toBe('Travel')
    expect(data.i).toHaveLength(2)
    expect(data.i[0].n).toBe('Passport')
    expect(data.i[1].n).toBe('T-Shirts')
    expect(data.i[1].q).toBe(5)
  })

  it('should decode a valid QR string correctly', () => {
    const jsonString = JSON.stringify({
      t: 'p',
      c: 'Backpacking',
      i: [{ n: 'Tent' }, { n: 'Sleeping Bag', q: 1 }]
    })
    
    const { category, items } = decodePackingList(jsonString)
    
    expect(category).toBe('Backpacking')
    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('Tent')
    expect(items[0].category).toBe('Backpacking')
    expect(items[1].name).toBe('Sleeping Bag')
    expect(items[1].quantity).toBe(1)
  })

  it('should throw error for invalid format', () => {
    const invalidJson = JSON.stringify({ t: 'unknown', i: [] })
    expect(() => decodePackingList(invalidJson)).toThrow('Invalid QR code format')
  })

  it('should throw error for malformed JSON', () => {
    expect(() => decodePackingList('not a json')).toThrow('Failed to parse QR code data')
  })
})
