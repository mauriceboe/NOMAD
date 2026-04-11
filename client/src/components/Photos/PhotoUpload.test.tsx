import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { render } from '../../../tests/helpers/render'
import { resetAllStores } from '../../../tests/helpers/store'
import { PhotoUpload } from './PhotoUpload'

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true })
})

const defaultProps = {
  tripId: 1,
  days: [{ id: 1, day_number: 1, date: null }],
  places: [{ id: 1, name: 'Eiffel Tower' }],
  onUpload: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
}

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['(binary)'], name, { type })
}

async function uploadFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, files)
}

/** The upload/submit button is always the last button in the DOM. */
function getSubmitButton() {
  const buttons = screen.getAllByRole('button')
  return buttons[buttons.length - 1]
}

describe('PhotoUpload', () => {
  beforeEach(() => {
    resetAllStores()
    vi.clearAllMocks()
    defaultProps.onUpload = vi.fn().mockResolvedValue(undefined)
    defaultProps.onClose = vi.fn()
  })

  it('FE-COMP-PHOTOUPLOAD-001: renders dropzone with upload instructions', () => {
    render(<PhotoUpload {...defaultProps} />)
    expect(screen.getByText('Fotos hier ablegen')).toBeInTheDocument()
    // Upload icon rendered via lucide-react as SVG
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('FE-COMP-PHOTOUPLOAD-002: options section hidden before files are selected', () => {
    render(<PhotoUpload {...defaultProps} />)
    expect(screen.queryByText('Tag verknüpfen')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Optionale Beschriftung...')).not.toBeInTheDocument()
  })

  it('FE-COMP-PHOTOUPLOAD-003: upload button is disabled when no files selected', () => {
    render(<PhotoUpload {...defaultProps} />)
    // The upload button is the last button and should be disabled with no files
    const uploadBtn = getSubmitButton()
    expect(uploadBtn).toBeDisabled()
  })

  it('FE-COMP-PHOTOUPLOAD-004: selecting a file shows preview and reveals options', async () => {
    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile()])
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
    expect(screen.getByText('Tag verknüpfen')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Optionale Beschriftung...')).toBeInTheDocument()
  })

  it('FE-COMP-PHOTOUPLOAD-005: file count label updates correctly', async () => {
    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile('photo1.jpg'), makeFile('photo2.jpg')])
    expect(screen.getByText('2 Fotos ausgewählt')).toBeInTheDocument()
  })

  it('FE-COMP-PHOTOUPLOAD-006: remove button removes a file from preview', async () => {
    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile('photo1.jpg'), makeFile('photo2.jpg')])
    expect(screen.getByText('2 Fotos ausgewählt')).toBeInTheDocument()

    // Remove buttons are inside `.relative.aspect-square` wrappers in the preview grid
    const removeButtons = document.querySelectorAll('.relative.aspect-square button')
    expect(removeButtons.length).toBe(2)
    await userEvent.click(removeButtons[0])

    expect(screen.getByText('1 Foto ausgewählt')).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBe(1)
  })

  it('FE-COMP-PHOTOUPLOAD-007: upload button calls onUpload with FormData', async () => {
    render(<PhotoUpload {...defaultProps} />)
    const file = makeFile()
    await uploadFiles([file])

    await userEvent.click(getSubmitButton())

    expect(defaultProps.onUpload).toHaveBeenCalledOnce()
    const formData = defaultProps.onUpload.mock.calls[0][0] as FormData
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('photos')).toBe(file)
  })

  it('FE-COMP-PHOTOUPLOAD-008: day selection adds day_id to FormData', async () => {
    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile()])

    // First combobox is the day selector; select day id=1
    const selects = screen.getAllByRole('combobox')
    await userEvent.selectOptions(selects[0], '1')

    await userEvent.click(getSubmitButton())

    const formData = defaultProps.onUpload.mock.calls[0][0] as FormData
    expect(formData.get('day_id')).toBe('1')
  })

  it('FE-COMP-PHOTOUPLOAD-009: caption field adds caption to FormData', async () => {
    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile()])

    await userEvent.type(screen.getByPlaceholderText('Optionale Beschriftung...'), 'Vacation')

    await userEvent.click(getSubmitButton())

    const formData = defaultProps.onUpload.mock.calls[0][0] as FormData
    expect(formData.get('caption')).toBe('Vacation')
  })

  it('FE-COMP-PHOTOUPLOAD-010: cancel button calls onClose', async () => {
    render(<PhotoUpload {...defaultProps} />)
    const cancelBtn = screen.getByRole('button', { name: /abbrechen|cancel/i })
    await userEvent.click(cancelBtn)
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('FE-COMP-PHOTOUPLOAD-011: upload in progress shows spinner and disables button', async () => {
    let resolveUpload!: () => void
    const pendingPromise = new Promise<void>(resolve => { resolveUpload = resolve })
    defaultProps.onUpload = vi.fn().mockReturnValue(pendingPromise)

    render(<PhotoUpload {...defaultProps} />)
    await uploadFiles([makeFile()])

    await userEvent.click(getSubmitButton())

    await waitFor(() => {
      expect(screen.getByText(/wird hochgeladen/i)).toBeInTheDocument()
    })

    expect(getSubmitButton()).toBeDisabled()

    // Cleanup
    resolveUpload()
  })
})
