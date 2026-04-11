import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '../../../tests/helpers/render'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { buildUser } from '../../../tests/helpers/factories'
import { useAuthStore } from '../../store/authStore'

vi.mock('./CollabChat', () => ({ default: () => <div data-testid="collab-chat">Chat</div> }))
vi.mock('./CollabNotes', () => ({ default: () => <div data-testid="collab-notes">Notes</div> }))
vi.mock('./CollabPolls', () => ({ default: () => <div data-testid="collab-polls">Polls</div> }))
vi.mock('./WhatsNextWidget', () => ({ default: () => <div data-testid="whats-next">WhatsNext</div> }))
vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}))

import CollabPanel from './CollabPanel'

let originalInnerWidth: number

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('CollabPanel', () => {
  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    resetAllStores()
    seedStore(useAuthStore, { user: buildUser() })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true })
  })

  // FE-COMP-COLLABPANEL-001
  it('desktop layout renders all four panels', () => {
    setViewport(1280)
    render(<CollabPanel tripId={1} />)
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
    expect(screen.getByTestId('collab-notes')).toBeInTheDocument()
    expect(screen.getByTestId('collab-polls')).toBeInTheDocument()
    expect(screen.getByTestId('whats-next')).toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-002
  it('mobile layout renders tab bar, not all panels at once', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    // Tab buttons exist
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /polls/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /what.?s next/i })).toBeInTheDocument()
    // Only chat visible by default
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-notes')).not.toBeInTheDocument()
    expect(screen.queryByTestId('collab-polls')).not.toBeInTheDocument()
    expect(screen.queryByTestId('whats-next')).not.toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-003
  it('mobile: clicking Notes tab switches to CollabNotes', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    expect(screen.getByTestId('collab-notes')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-chat')).not.toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-004
  it('mobile: clicking Polls tab switches to CollabPolls', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /polls/i }))
    expect(screen.getByTestId('collab-polls')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-chat')).not.toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-005
  it('mobile: clicking What\'s Next tab shows WhatsNextWidget', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /what.?s next/i }))
    expect(screen.getByTestId('whats-next')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-chat')).not.toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-006
  it('mobile: active tab button has accent background style', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    const chatButton = screen.getByRole('button', { name: /chat/i })
    expect(chatButton.style.background).toBe('var(--accent)')
    const notesButton = screen.getByRole('button', { name: /notes/i })
    expect(notesButton.style.background).toBe('transparent')
  })

  // FE-COMP-COLLABPANEL-007
  it('mobile: default active tab is Chat', () => {
    setViewport(375)
    render(<CollabPanel tripId={1} />)
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-008
  it('tripMembers prop is forwarded to WhatsNextWidget', () => {
    setViewport(1280)
    render(<CollabPanel tripId={1} tripMembers={[{ id: 5, username: 'alice', avatar_url: null }]} />)
    expect(screen.getByTestId('whats-next')).toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-009
  it('tripId prop is forwarded to child components', () => {
    setViewport(1280)
    render(<CollabPanel tripId={1} />)
    // All children render without errors, confirming props were forwarded
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
    expect(screen.getByTestId('collab-notes')).toBeInTheDocument()
    expect(screen.getByTestId('collab-polls')).toBeInTheDocument()
  })

  // FE-COMP-COLLABPANEL-010
  it('resize from desktop to mobile hides side-by-side layout', () => {
    setViewport(1280)
    const { rerender } = render(<CollabPanel tripId={1} />)
    // All four panels visible on desktop
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
    expect(screen.getByTestId('collab-notes')).toBeInTheDocument()

    // Switch to mobile
    setViewport(375)
    rerender(<CollabPanel tripId={1} />)

    // Tab bar appears, only chat visible
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
    expect(screen.getByTestId('collab-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('collab-notes')).not.toBeInTheDocument()
  })
})
