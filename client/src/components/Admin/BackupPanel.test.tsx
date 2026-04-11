import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '../../../tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { useSettingsStore } from '../../store/settingsStore'
import { server } from '../../../tests/helpers/msw/server'
import { http, HttpResponse } from 'msw'
import BackupPanel from './BackupPanel'
import { ToastContainer } from '../shared/Toast'

const manualBackup = {
  filename: 'backup-2025-01-15.zip',
  created_at: '2025-01-15T10:00:00Z',
  size: 2048000,
}
const autoBackup = {
  filename: 'auto-backup-2025-02-01.zip',
  created_at: '2025-02-01T02:00:00Z',
  size: 1024000,
}

function defaultBackupHandlers() {
  return [
    http.get('/api/backup/list', () => HttpResponse.json({ backups: [manualBackup] })),
    http.get('/api/backup/auto-settings', () =>
      HttpResponse.json({
        settings: { enabled: false, interval: 'daily', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 },
        timezone: 'UTC',
      }),
    ),
  ]
}

function getToggleButton() {
  // The enable toggle is a <button> inside a <label> that contains "Enable auto-backup"
  const label = screen.getByText('Enable auto-backup').closest('label') as HTMLElement
  return label.querySelector('button') as HTMLElement
}

describe('BackupPanel', () => {
  beforeEach(() => {
    resetAllStores()
    seedStore(useSettingsStore, { settings: { time_format: '24h' } } as any)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    server.use(...defaultBackupHandlers())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    server.resetHandlers()
  })

  // BKP-001: Loading state
  it('FE-ADMIN-BKP-001: shows loading spinner while fetching backups', async () => {
    server.use(
      http.get('/api/backup/list', async () => {
        await new Promise(resolve => setTimeout(resolve, 300))
        return HttpResponse.json({ backups: [] })
      }),
    )
    render(<BackupPanel />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  // BKP-002: Empty state
  it('FE-ADMIN-BKP-002: shows empty state when no backups exist', async () => {
    server.use(
      http.get('/api/backup/list', () => HttpResponse.json({ backups: [] })),
    )
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('No backups yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Create first backup')).toBeInTheDocument()
  })

  // BKP-003: Backup list renders filename, size, and date
  it('FE-ADMIN-BKP-003: renders filename, formatted size, and date for a backup', async () => {
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    expect(screen.getByText('2.0 MB')).toBeInTheDocument()
  })

  // BKP-004: Auto-backup badge shown for auto-backup filenames
  it('FE-ADMIN-BKP-004: shows Auto badge for auto-backup filenames', async () => {
    server.use(
      http.get('/api/backup/list', () => HttpResponse.json({ backups: [autoBackup] })),
    )
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('auto-backup-2025-02-01.zip')).toBeInTheDocument()
    })
    expect(screen.getByText('Auto')).toBeInTheDocument()
  })

  // BKP-005: Create backup success
  it('FE-ADMIN-BKP-005: creates backup and shows success toast', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/backup/create', () => HttpResponse.json({ success: true })),
      http.get('/api/backup/list', () => HttpResponse.json({ backups: [manualBackup] })),
    )
    render(<><ToastContainer /><BackupPanel /></>)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    await user.click(screen.getByTitle('Create Backup'))
    await waitFor(() => {
      expect(screen.getByText('Backup created successfully')).toBeInTheDocument()
    })
  })

  // BKP-006: Restore opens confirmation modal
  it('FE-ADMIN-BKP-006: clicking Restore opens confirmation modal', async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    await user.click(screen.getAllByText('Restore')[0])
    await waitFor(() => {
      expect(screen.getByText('Restore Backup?')).toBeInTheDocument()
    })
    expect(screen.getAllByText('backup-2025-01-15.zip').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Yes, restore')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  // BKP-007: Cancel dismisses modal without calling restore API
  it('FE-ADMIN-BKP-007: cancel dismisses the restore modal without calling the API', async () => {
    const user = userEvent.setup()
    let restoreCalled = false
    server.use(
      http.post('/api/backup/restore/:filename', () => {
        restoreCalled = true
        return HttpResponse.json({ success: true })
      }),
    )
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    await user.click(screen.getAllByText('Restore')[0])
    await waitFor(() => {
      expect(screen.getByText('Restore Backup?')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Cancel'))
    await waitFor(() => {
      expect(screen.queryByText('Restore Backup?')).not.toBeInTheDocument()
    })
    expect(restoreCalled).toBe(false)
  })

  // BKP-008: Backdrop click dismisses modal
  it('FE-ADMIN-BKP-008: clicking the backdrop dismisses the restore modal', async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    await user.click(screen.getAllByText('Restore')[0])
    await waitFor(() => {
      expect(screen.getByText('Restore Backup?')).toBeInTheDocument()
    })
    // Click the backdrop overlay (the fixed-position div)
    const backdrop = document.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    await waitFor(() => {
      expect(screen.queryByText('Restore Backup?')).not.toBeInTheDocument()
    })
  })

  // BKP-009: Successful restore calls API and reloads after 1500ms
  it('FE-ADMIN-BKP-009: successful restore shows toast and reloads after 1500ms', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/backup/restore/:filename', () => HttpResponse.json({ success: true })),
    )
    render(<><ToastContainer /><BackupPanel /></>)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })

    // Stub reload AFTER initial data load so we don't corrupt window.location during setup
    const reloadMock = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadMock })

    await user.click(screen.getAllByText('Restore')[0])
    await waitFor(() => expect(screen.getByText('Restore Backup?')).toBeInTheDocument())
    await user.click(screen.getByText('Yes, restore'))
    await waitFor(() => expect(screen.getByText('Backup restored. Page will reload…')).toBeInTheDocument())

    // Wait for the 1500ms reload timer to fire
    await new Promise(resolve => setTimeout(resolve, 1600))
    expect(reloadMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
  }, 20000)

  // BKP-010: Delete backup with confirm dialog
  it('FE-ADMIN-BKP-010: deletes backup after confirm and shows success toast', async () => {
    const user = userEvent.setup()
    server.use(
      http.delete('/api/backup/:filename', () => HttpResponse.json({ success: true })),
    )
    render(<><ToastContainer /><BackupPanel /></>)
    await waitFor(() => {
      expect(screen.getByText('backup-2025-01-15.zip')).toBeInTheDocument()
    })
    const trashBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.querySelector('svg.lucide-trash2'),
    ) as HTMLElement
    expect(trashBtn).toBeTruthy()
    await user.click(trashBtn!)
    await waitFor(() => {
      expect(screen.getByText('Backup deleted')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText('backup-2025-01-15.zip')).not.toBeInTheDocument()
    })
  })

  // BKP-011: Auto-backup enable toggle shows interval controls
  it('FE-ADMIN-BKP-011: enabling auto-backup shows interval controls', async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('Enable auto-backup')).toBeInTheDocument()
    })
    expect(screen.queryByText('Hourly')).not.toBeInTheDocument()
    await user.click(getToggleButton())
    await waitFor(() => {
      expect(screen.getByText('Hourly')).toBeInTheDocument()
      expect(screen.getByText('Daily')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('Monthly')).toBeInTheDocument()
    })
  })

  // BKP-012: Weekly interval shows day-of-week picker
  it('FE-ADMIN-BKP-012: weekly interval shows day-of-week picker', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/backup/auto-settings', () =>
        HttpResponse.json({
          settings: { enabled: true, interval: 'daily', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 },
          timezone: 'UTC',
        }),
      ),
    )
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('Weekly')).toBeInTheDocument()
    })
    expect(screen.queryByText('Sun')).not.toBeInTheDocument()
    await user.click(screen.getByText('Weekly'))
    await waitFor(() => {
      expect(screen.getByText('Sun')).toBeInTheDocument()
      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Sat')).toBeInTheDocument()
    })
    expect(screen.queryByText('Day of month')).not.toBeInTheDocument()
  })

  // BKP-013: Save auto-settings calls API and shows toast
  it('FE-ADMIN-BKP-013: saving auto-settings calls API and shows success toast', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/backup/auto-settings', () =>
        HttpResponse.json({
          settings: { enabled: true, interval: 'daily', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 },
          timezone: 'UTC',
        }),
      ),
      http.put('/api/backup/auto-settings', () =>
        HttpResponse.json({
          settings: { enabled: true, interval: 'weekly', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 },
        }),
      ),
    )
    render(<><ToastContainer /><BackupPanel /></>)
    await waitFor(() => {
      expect(screen.getByText('Weekly')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Weekly'))
    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /^save$/i })
      expect(saveBtn).not.toBeDisabled()
    })
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => {
      expect(screen.getByText('Auto-backup settings saved')).toBeInTheDocument()
    })
  })

  // BKP-014: Save button disabled until settings changed
  it('FE-ADMIN-BKP-014: save button is disabled until settings are changed', async () => {
    const user = userEvent.setup()
    render(<BackupPanel />)
    await waitFor(() => {
      expect(screen.getByText('Enable auto-backup')).toBeInTheDocument()
    })
    const saveBtn = screen.getByRole('button', { name: /^save$/i })
    expect(saveBtn).toBeDisabled()
    await user.click(getToggleButton())
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
    })
  })
})
