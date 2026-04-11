// FE-ADMIN-MCP-001 to FE-ADMIN-MCP-010
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { resetAllStores } from '../../../tests/helpers/store';
import { ToastContainer } from '../shared/Toast';
import AdminMcpTokensPanel from './AdminMcpTokensPanel';

const TOKEN_1 = {
  id: 1,
  name: 'CI Token',
  token_prefix: 'trek_abc',
  created_at: '2025-01-15T00:00:00Z',
  last_used_at: null,
  user_id: 10,
  username: 'alice',
};

const TOKEN_2 = {
  id: 2,
  name: 'Ops Token',
  token_prefix: 'trek_xyz',
  created_at: '2025-03-01T00:00:00Z',
  last_used_at: '2025-04-01T00:00:00Z',
  user_id: 11,
  username: 'bob',
};

beforeEach(() => {
  resetAllStores();
});

afterEach(() => {
  server.resetHandlers();
});

describe('AdminMcpTokensPanel', () => {
  it('FE-ADMIN-MCP-001: loading spinner shown on mount', async () => {
    server.use(
      http.get('/api/admin/mcp-tokens', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return HttpResponse.json({ tokens: [] });
      })
    );
    render(<AdminMcpTokensPanel />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-002: empty state rendered when no tokens', async () => {
    render(<AdminMcpTokensPanel />);
    await screen.findByText('No MCP tokens have been created yet');
  });

  it('FE-ADMIN-MCP-003: token list renders correctly', async () => {
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      )
    );
    render(<AdminMcpTokensPanel />);
    await screen.findByText('CI Token');
    expect(screen.getByText('Ops Token')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    // token_prefix is rendered as `{token.token_prefix}...` — two adjacent text nodes
    expect(screen.getByText(/trek_abc/)).toBeInTheDocument();
    expect(screen.getByText(/trek_xyz/)).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-004: "Never" shown when last_used_at is null', async () => {
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      )
    );
    render(<AdminMcpTokensPanel />);
    await screen.findByText('CI Token');
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-005: delete confirmation dialog opens', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      )
    );
    render(<AdminMcpTokensPanel />);
    await screen.findByText('CI Token');

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(screen.getByText('Delete Token')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // Dialog Delete button has visible text "Delete"; trash icon buttons have no text content
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-006: cancel closes confirmation dialog without deleting', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      )
    );
    render(<AdminMcpTokensPanel />);
    await screen.findByText('CI Token');

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);
    expect(screen.getByText('Delete Token')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Delete Token')).not.toBeInTheDocument();
    expect(screen.getByText('CI Token')).toBeInTheDocument();
    expect(screen.getByText('Ops Token')).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-007: backdrop click closes dialog', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      )
    );
    render(<AdminMcpTokensPanel />);
    await screen.findByText('CI Token');

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);
    expect(screen.getByText('Delete Token')).toBeInTheDocument();

    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    await waitFor(() => {
      expect(screen.queryByText('Delete Token')).not.toBeInTheDocument();
    });
  });

  it('FE-ADMIN-MCP-008: successful delete removes token from list', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      ),
      http.delete('/api/admin/mcp-tokens/:id', () =>
        HttpResponse.json({ success: true })
      )
    );
    render(<><ToastContainer /><AdminMcpTokensPanel /></>);
    await screen.findByText('CI Token');

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);
    await user.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(screen.queryByText('Delete Token')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('CI Token')).not.toBeInTheDocument();
    expect(screen.getByText('Ops Token')).toBeInTheDocument();
    await screen.findByText('Token deleted');
  });

  it('FE-ADMIN-MCP-009: failed delete shows error toast and keeps list unchanged', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ tokens: [TOKEN_1, TOKEN_2] })
      ),
      http.delete('/api/admin/mcp-tokens/:id', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 })
      )
    );
    render(<><ToastContainer /><AdminMcpTokensPanel /></>);
    await screen.findByText('CI Token');

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);
    await user.click(screen.getByText('Delete'));

    await screen.findByText('Failed to delete token');
    expect(screen.getByText('CI Token')).toBeInTheDocument();
  });

  it('FE-ADMIN-MCP-010: load failure shows error toast', async () => {
    server.use(
      http.get('/api/admin/mcp-tokens', () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 })
      )
    );
    render(<><ToastContainer /><AdminMcpTokensPanel /></>);
    await screen.findByText('Failed to load tokens');
  });
});
