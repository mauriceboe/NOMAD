// FE-ADMIN-AUDIT-001 to FE-ADMIN-AUDIT-010
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { resetAllStores } from '../../../tests/helpers/store';
import AuditLogPanel from './AuditLogPanel';

const ENTRY_1 = {
  id: 1,
  created_at: '2025-06-01T10:30:00Z',
  user_id: 5,
  username: 'alice',
  user_email: 'alice@example.com',
  action: 'trip.create',
  resource: '/trips/42',
  details: { title: 'Test' },
  ip: '127.0.0.1',
};

const ENTRY_2 = {
  id: 2,
  created_at: '2025-06-02T11:00:00Z',
  user_id: 6,
  username: 'bob',
  user_email: 'bob@example.com',
  action: 'trip.delete',
  resource: '/trips/43',
  details: null,
  ip: '10.0.0.1',
};

beforeEach(() => {
  resetAllStores();
});

afterEach(() => {
  server.resetHandlers();
});

describe('AuditLogPanel', () => {
  it('FE-ADMIN-AUDIT-001: loading state shown on mount', async () => {
    server.use(
      http.get('/api/admin/audit-log', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json({ entries: [], total: 0 });
      }),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-002: empty state shown when no entries', async () => {
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries: [], total: 0 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('No audit entries yet.');
    expect(document.querySelector('table')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-003: table renders all columns with data', async () => {
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries: [ENTRY_1], total: 1 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('trip.create');
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText('IP')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('/trips/42')).toBeInTheDocument();
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('{"title":"Test"}')).toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-004: userLabel fallback chain', async () => {
    const entries = [
      { ...ENTRY_1, id: 10, username: 'alice', user_email: null, user_id: 5, action: 'a.username' },
      { ...ENTRY_1, id: 11, username: null, user_email: 'bob@example.com', user_id: 6, action: 'a.email' },
      { ...ENTRY_1, id: 12, username: null, user_email: null, user_id: 7, action: 'a.id' },
      { ...ENTRY_1, id: 13, username: null, user_email: null, user_id: null, action: 'a.none' },
    ];
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries, total: 4 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('a.username');
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    // '—' appears multiple times (null resource, null ip for some, null user) — just check it exists
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('FE-ADMIN-AUDIT-005: dash shown for null resource, ip, and details', async () => {
    const entry = {
      ...ENTRY_1,
      id: 20,
      action: 'a.nulls',
      resource: null,
      ip: null,
      details: null,
    };
    const entryEmptyDetails = {
      ...ENTRY_1,
      id: 21,
      action: 'a.emptyobj',
      resource: '/ok',
      ip: '1.2.3.4',
      details: {},
    };
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries: [entry, entryEmptyDetails], total: 2 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('a.nulls');
    // null resource, null ip, null details → three '—' for entry; empty obj details → another '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('FE-ADMIN-AUDIT-006: showing count text reflects count and total', async () => {
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries: [ENTRY_1], total: 50 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('trip.create');
    expect(screen.getByText('1 loaded · 50 total')).toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-007: "Load more" appends entries', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/admin/audit-log', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ entries: [ENTRY_1], total: 2 });
        }
        return HttpResponse.json({ entries: [ENTRY_2], total: 2 });
      }),
    );
    const user = userEvent.setup();
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('trip.create');
    const loadMoreBtn = screen.getByText('Load more');
    expect(loadMoreBtn).toBeInTheDocument();
    await user.click(loadMoreBtn);
    await screen.findByText('trip.delete');
    expect(screen.getByText('trip.create')).toBeInTheDocument();
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-008: "Load more" hidden when all entries loaded', async () => {
    server.use(
      http.get('/api/admin/audit-log', () =>
        HttpResponse.json({ entries: [ENTRY_1, ENTRY_2], total: 2 }),
      ),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    await screen.findByText('trip.create');
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-009: Refresh resets list to page 1', async () => {
    const PAGE1_ENTRY = { ...ENTRY_1, id: 100, action: 'phase1.action' };
    const PAGE2_ENTRY = { ...ENTRY_2, id: 101, action: 'phase2.action' };
    const REFRESH_ENTRY = { ...ENTRY_2, id: 102, action: 'phase3.refresh' };
    let callCount = 0;
    server.use(
      http.get('/api/admin/audit-log', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ entries: [PAGE1_ENTRY], total: 2 });
        }
        if (callCount === 2) {
          return HttpResponse.json({ entries: [PAGE2_ENTRY], total: 2 });
        }
        return HttpResponse.json({ entries: [REFRESH_ENTRY], total: 1 });
      }),
    );
    const user = userEvent.setup();
    render(<AuditLogPanel serverTimezone="UTC" />);
    // Initial load: PAGE1_ENTRY visible, load more
    await screen.findByText('phase1.action');
    const loadMoreBtn = screen.getByText('Load more');
    await user.click(loadMoreBtn);
    await screen.findByText('phase2.action');
    // Now refresh
    const refreshBtn = screen.getByText('Refresh');
    await user.click(refreshBtn);
    // After refresh, only REFRESH_ENTRY should be visible
    await screen.findByText('phase3.refresh');
    await waitFor(() => expect(screen.queryByText('phase1.action')).not.toBeInTheDocument());
    expect(screen.queryByText('phase2.action')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-AUDIT-010: Refresh button is disabled while loading', async () => {
    server.use(
      http.get('/api/admin/audit-log', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json({ entries: [], total: 0 });
      }),
    );
    render(<AuditLogPanel serverTimezone="UTC" />);
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn.closest('button')).toBeDisabled();
  });
});
