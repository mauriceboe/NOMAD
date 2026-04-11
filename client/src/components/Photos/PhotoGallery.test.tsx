import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render } from '../../../tests/helpers/render'
import { resetAllStores } from '../../../tests/helpers/store'
import PhotoGallery from './PhotoGallery'

vi.mock('./PhotoLightbox', () => ({
  PhotoLightbox: ({ onClose, onDelete, photos, initialIndex }: any) => (
    <div data-testid="lightbox" data-index={initialIndex}>
      <button onClick={onClose}>close-lightbox</button>
      <button onClick={() => onDelete(photos[initialIndex]?.id)}>delete-photo</button>
    </div>
  ),
}))

vi.mock('./PhotoUpload', () => ({
  PhotoUpload: ({ onClose }: any) => (
    <div data-testid="photo-upload">
      <button onClick={onClose}>close-upload</button>
    </div>
  ),
}))

vi.mock('../shared/Modal', () => ({
  default: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="modal">{children}</div> : null,
}))

const buildPhoto = (overrides = {}) => ({
  id: 1,
  url: '/uploads/photo1.jpg',
  caption: null,
  original_name: 'photo1.jpg',
  day_id: null,
  place_id: null,
  file_size: 102400,
  created_at: '2025-01-15T12:00:00Z',
  ...overrides,
})

const defaultProps = {
  onUpload: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onUpdate: vi.fn().mockResolvedValue(undefined),
  places: [],
  days: [],
  tripId: 1,
}

describe('PhotoGallery', () => {
  beforeEach(() => {
    resetAllStores()
    vi.clearAllMocks()
    defaultProps.onUpload = vi.fn().mockResolvedValue(undefined)
    defaultProps.onDelete = vi.fn().mockResolvedValue(undefined)
    defaultProps.onUpdate = vi.fn().mockResolvedValue(undefined)
  })

  it('FE-COMP-PHOTOGALLERY-001: shows photo count in header', () => {
    const photos = [buildPhoto(), buildPhoto({ id: 2 })]
    render(<PhotoGallery {...defaultProps} photos={photos} />)
    // The count paragraph renders "2 Fotos" as split text nodes
    expect(screen.getByText((content, el) => el?.tagName === 'P' && el.textContent?.trim().startsWith('2'))).toBeInTheDocument()
    expect(screen.getAllByText('Fotos').length).toBeGreaterThan(0)
  })

  it('FE-COMP-PHOTOGALLERY-002: shows empty state when no photos', () => {
    render(<PhotoGallery {...defaultProps} photos={[]} />)
    // noPhotos key renders some text — check the empty state container is visible
    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(0)
    // The empty-state button should exist
    const uploadButtons = screen.getAllByRole('button')
    expect(uploadButtons.length).toBeGreaterThan(0)
  })

  it('FE-COMP-PHOTOGALLERY-003: renders one thumbnail per photo plus one upload tile', () => {
    const photos = [buildPhoto(), buildPhoto({ id: 2 }), buildPhoto({ id: 3 })]
    render(<PhotoGallery {...defaultProps} photos={photos} />)
    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(3)
    // Upload tile button (with Upload icon and "add" text) is present
    const buttons = screen.getAllByRole('button')
    // At least the upload tile button exists alongside the header upload button
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('FE-COMP-PHOTOGALLERY-004: clicking thumbnail opens lightbox at correct index', async () => {
    const user = userEvent.setup()
    const photos = [buildPhoto(), buildPhoto({ id: 2 })]
    render(<PhotoGallery {...defaultProps} photos={photos} />)

    const thumbnails = document.querySelectorAll('.aspect-square.rounded-xl.overflow-hidden')
    expect(thumbnails).toHaveLength(2)
    await user.click(thumbnails[1] as HTMLElement)

    expect(screen.getByTestId('lightbox')).toBeInTheDocument()
    expect(screen.getByTestId('lightbox').getAttribute('data-index')).toBe('1')
  })

  it('FE-COMP-PHOTOGALLERY-005: closing lightbox hides it', async () => {
    const user = userEvent.setup()
    const photos = [buildPhoto()]
    render(<PhotoGallery {...defaultProps} photos={photos} />)

    const thumbnail = document.querySelector('.aspect-square.rounded-xl.overflow-hidden')
    await user.click(thumbnail as HTMLElement)
    expect(screen.getByTestId('lightbox')).toBeInTheDocument()

    await user.click(screen.getByText('close-lightbox'))
    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('FE-COMP-PHOTOGALLERY-006: upload button opens upload modal', async () => {
    const user = userEvent.setup()
    render(<PhotoGallery {...defaultProps} photos={[]} />)

    // The header upload button
    const uploadButtons = screen.getAllByRole('button')
    // First button with Upload icon in header
    await user.click(uploadButtons[0])

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByTestId('photo-upload')).toBeInTheDocument()
  })

  it('FE-COMP-PHOTOGALLERY-007: day filter dropdown shows all days as options', () => {
    const days = [
      { id: 1, day_number: 1, date: '2025-01-10', trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
      { id: 2, day_number: 2, date: null, trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
    ]
    render(<PhotoGallery {...defaultProps} photos={[]} days={days} />)

    const select = screen.getByRole('combobox')
    const options = Array.from(select.querySelectorAll('option'))
    // "All days" + 2 day options
    expect(options.length).toBe(3)
  })

  it('FE-COMP-PHOTOGALLERY-008: filtering by day hides photos from other days', async () => {
    const user = userEvent.setup()
    const days = [
      { id: 1, day_number: 1, date: null, trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
      { id: 2, day_number: 2, date: null, trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
    ]
    const photos = [
      buildPhoto({ id: 1, day_id: 1 }),
      buildPhoto({ id: 2, day_id: 2 }),
    ]
    render(<PhotoGallery {...defaultProps} photos={photos} days={days} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '1')

    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
  })

  it('FE-COMP-PHOTOGALLERY-009: reset filter button appears and clears filter', async () => {
    const user = userEvent.setup()
    const days = [
      { id: 1, day_number: 1, date: null, trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
      { id: 2, day_number: 2, date: null, trip_id: 1, title: null, notes: null, assignments: [], notes_items: [] },
    ]
    const photos = [
      buildPhoto({ id: 1, day_id: 1 }),
      buildPhoto({ id: 2, day_id: 2 }),
    ]
    render(<PhotoGallery {...defaultProps} photos={photos} days={days} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '1')

    // Reset button should now be visible
    const resetButton = screen.getByRole('button', { name: /reset/i })
    expect(resetButton).toBeInTheDocument()

    await user.click(resetButton)

    const imgs = document.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
  })

  it('FE-COMP-PHOTOGALLERY-010: deleting last photo in lightbox closes lightbox', async () => {
    const user = userEvent.setup()
    const photos = [buildPhoto({ id: 1 })]
    render(<PhotoGallery {...defaultProps} photos={photos} />)

    const thumbnail = document.querySelector('.aspect-square.rounded-xl.overflow-hidden')
    await user.click(thumbnail as HTMLElement)
    expect(screen.getByTestId('lightbox')).toBeInTheDocument()

    await user.click(screen.getByText('delete-photo'))

    expect(screen.queryByTestId('lightbox')).not.toBeInTheDocument()
  })

  it('FE-COMP-PHOTOGALLERY-011: deleting a photo adjusts lightbox index when beyond bounds', async () => {
    const user = userEvent.setup()
    const photos = [buildPhoto({ id: 1 }), buildPhoto({ id: 2 })]
    render(<PhotoGallery {...defaultProps} photos={photos} />)

    const thumbnails = document.querySelectorAll('.aspect-square.rounded-xl.overflow-hidden')
    await user.click(thumbnails[1] as HTMLElement)

    expect(screen.getByTestId('lightbox').getAttribute('data-index')).toBe('1')

    await user.click(screen.getByText('delete-photo'))

    // Lightbox should still be open but at index 0
    expect(screen.getByTestId('lightbox')).toBeInTheDocument()
    expect(screen.getByTestId('lightbox').getAttribute('data-index')).toBe('0')
  })
})
