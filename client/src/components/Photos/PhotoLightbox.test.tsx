import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { resetAllStores } from '../../../tests/helpers/store'
import { PhotoLightbox } from './PhotoLightbox'

const buildPhoto = (overrides = {}) => ({
  id: 1,
  url: '/uploads/p1.jpg',
  caption: null,
  original_name: 'p1.jpg',
  day_id: null,
  place_id: null,
  file_size: 204800,
  created_at: '2025-03-10T10:00:00Z',
  ...overrides,
})

const defaultProps = {
  photos: [buildPhoto({ id: 1 }), buildPhoto({ id: 2, url: '/uploads/p2.jpg', original_name: 'p2.jpg' })],
  initialIndex: 0,
  onClose: vi.fn(),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  days: [],
  places: [],
  tripId: 99,
}

describe('PhotoLightbox', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetAllStores()
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('FE-COMP-PHOTOLIGHTBOX-001: renders the current photo', () => {
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)
    const img = screen.getByRole('img', { name: /p1\.jpg/i })
    expect(img).toHaveAttribute('src', '/uploads/p1.jpg')
  })

  it('FE-COMP-PHOTOLIGHTBOX-002: shows photo counter "1 / 2"', () => {
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('FE-COMP-PHOTOLIGHTBOX-003: next button advances to second photo', async () => {
    const user = userEvent.setup()
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)

    // Find the ChevronRight button — it's the one after the image in the image area
    const buttons = screen.getAllByRole('button')
    const nextBtn = buttons.find(btn => btn.querySelector('svg') && btn.className.includes('rounded-full') && btn.className.includes('right-4'))
      ?? buttons.find(btn => btn.className.includes('rounded-full') && !btn.className.includes('left-4'))

    // Use the button with ChevronRight — at index 0, only next button is shown
    // It's within the image area, has class "rounded-full" and no left-4
    const imageAreaButtons = buttons.filter(btn => btn.className.includes('rounded-full'))
    expect(imageAreaButtons).toHaveLength(1) // only next at index 0

    await user.click(imageAreaButtons[0])

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    const img = screen.getByRole('img', { name: /p2\.jpg/i })
    expect(img).toHaveAttribute('src', '/uploads/p2.jpg')
  })

  it('FE-COMP-PHOTOLIGHTBOX-004: prev button not shown at index 0', () => {
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)
    // At index 0 only the next (ChevronRight) rounded-full button appears
    const roundedButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('rounded-full'),
    )
    expect(roundedButtons).toHaveLength(1)
    // Confirm this single button is the next button (right-4)
    expect(roundedButtons[0].className).toContain('right-4')
  })

  it('FE-COMP-PHOTOLIGHTBOX-005: ArrowRight keyboard event advances photo', () => {
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('FE-COMP-PHOTOLIGHTBOX-006: Escape keyboard event calls onClose', () => {
    render(<PhotoLightbox {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('FE-COMP-PHOTOLIGHTBOX-007: clicking backdrop calls onClose', async () => {
    const user = userEvent.setup()
    const { container } = render(<PhotoLightbox {...defaultProps} />)
    // The outer div.fixed has the onClick={onClose}. Click it directly.
    const backdrop = container.firstChild as HTMLElement
    await user.click(backdrop)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('FE-COMP-PHOTOLIGHTBOX-008: delete button triggers confirm and calls onDelete', async () => {
    confirmSpy.mockReturnValue(true)
    const user = userEvent.setup()
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)

    // The trash button has title matching delete
    const trashBtn = screen.getByTitle(/delete|löschen/i)
    await user.click(trashBtn)

    expect(confirmSpy).toHaveBeenCalled()
    expect(defaultProps.onDelete).toHaveBeenCalledWith(1)
  })

  it('FE-COMP-PHOTOLIGHTBOX-009: delete cancelled via confirm does not call onDelete', async () => {
    confirmSpy.mockReturnValue(false)
    const user = userEvent.setup()
    render(<PhotoLightbox {...defaultProps} initialIndex={0} />)

    const trashBtn = screen.getByTitle(/delete|löschen/i)
    await user.click(trashBtn)

    expect(confirmSpy).toHaveBeenCalled()
    expect(defaultProps.onDelete).not.toHaveBeenCalled()
  })

  it('FE-COMP-PHOTOLIGHTBOX-010: clicking caption text enters edit mode', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      photos: [buildPhoto({ id: 1, caption: 'Sunset view' })],
    }
    render(<PhotoLightbox {...props} initialIndex={0} />)

    // Click on the caption paragraph
    const captionEl = screen.getByText('Sunset view')
    await user.click(captionEl)

    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    expect(input).toHaveValue('Sunset view')
  })

  it('FE-COMP-PHOTOLIGHTBOX-011: saving caption calls onUpdate', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      photos: [buildPhoto({ id: 1, caption: 'Old caption' })],
    }
    render(<PhotoLightbox {...props} initialIndex={0} />)

    // Enter edit mode
    await user.click(screen.getByText('Old caption'))

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New caption')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(defaultProps.onUpdate).toHaveBeenCalledWith(1, { caption: 'New caption' })
    })
  })

  it('FE-COMP-PHOTOLIGHTBOX-012: thumbnail strip renders for multiple photos', () => {
    const { container } = render(<PhotoLightbox {...defaultProps} initialIndex={0} />)

    // Thumbnail strip has buttons each containing an img with alt=""
    // querySelectorAll finds them regardless of ARIA role filtering
    const thumbnailImgs = container.querySelectorAll('button img[alt=""]')
    expect(thumbnailImgs).toHaveLength(2)
  })

  it('FE-COMP-PHOTOLIGHTBOX-013: day and place metadata displayed when photo has day/place', () => {
    const props = {
      ...defaultProps,
      photos: [buildPhoto({ id: 1, day_id: 1, place_id: 1 })],
      days: [{ id: 1, day_number: 2, trip_id: 99, date: null, notes: null }],
      places: [{ id: 1, name: 'Colosseum', trip_id: 99, lat: null, lng: null, category: null, notes: null, day_id: null, address: null, order_index: 0 }],
    }
    render(<PhotoLightbox {...props} initialIndex={0} />)

    expect(screen.getByText(/Tag 2/)).toBeInTheDocument()
    expect(screen.getByText(/Colosseum/)).toBeInTheDocument()
  })
})
