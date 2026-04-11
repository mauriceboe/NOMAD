// FE-COMP-INTEGRATIONS-001 to FE-COMP-INTEGRATIONS-018
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useAddonStore } from '../../store/addonStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser } from '../../../tests/helpers/factories';
import IntegrationsTab from './IntegrationsTab';

function enableMcp() {
  seedStore(useAddonStore, {
    addons: [{ id: 'mcp', name: 'MCP', type: 'integration', icon: '', enabled: true }],
    loaded: true,
    loadAddons: vi.fn(),
  });
}

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWriteText },
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  clipboardWriteText.mockClear();
  resetAllStores();
  vi.clearAllMocks();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useAddonStore, {
    addons: [],
    loaded: true,
    loadAddons: vi.fn(),
  });
  server.use(
    http.get('/api/auth/mcp-tokens', () => HttpResponse.json({ tokens: [] })),
    http.get('/api/addons', () => HttpResponse.json({ addons: [] })),
  );
});

describe('IntegrationsTab', () => {
  it('FE-COMP-INTEGRATIONS-001: renders without crashing (MCP disabled)', () => {
    render(<IntegrationsTab />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-INTEGRATIONS-002: MCP section is hidden when mcp addon is disabled', () => {
    render(<IntegrationsTab />);
    expect(screen.queryByText('MCP Configuration')).toBeNull();
  });

  it('FE-COMP-INTEGRATIONS-003: MCP section is visible when mcp addon is enabled', async () => {
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
  });

  it('FE-COMP-INTEGRATIONS-004: MCP endpoint URL is displayed', async () => {
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    const codeEl = document.querySelector('code');
    expect(codeEl).not.toBeNull();
    expect(codeEl!.textContent).toContain('/mcp');
  });

  it('FE-COMP-INTEGRATIONS-005: JSON config block is rendered', async () => {
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    const preEl = document.querySelector('pre');
    expect(preEl).not.toBeNull();
    expect(preEl!.textContent).toContain('mcpServers');
  });

  it('FE-COMP-INTEGRATIONS-006: "no tokens" message shown when token list is empty', async () => {
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('No tokens yet. Create one to connect MCP clients.');
  });

  it('FE-COMP-INTEGRATIONS-007: token list renders when tokens exist', async () => {
    server.use(
      http.get('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          tokens: [
            { id: 1, name: 'My Token', token_prefix: 'tk_aaa', created_at: '2025-01-01T00:00:00.000Z', last_used_at: null },
            { id: 2, name: 'Other Token', token_prefix: 'tk_bbb', created_at: '2025-01-01T00:00:00.000Z', last_used_at: null },
          ],
        }),
      ),
    );
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('My Token');
    await screen.findByText('Other Token');
  });

  it('FE-COMP-INTEGRATIONS-008: clicking "Create New Token" button opens the modal', async () => {
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    const createBtn = screen.getByRole('button', { name: /Create New Token/i });
    await user.click(createBtn);
    await screen.findByText('Create API Token');
  });

  it('FE-COMP-INTEGRATIONS-009: Create button in modal is disabled when name is empty', async () => {
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    await user.click(screen.getByRole('button', { name: /Create New Token/i }));
    await screen.findByText('Create API Token');
    const modalCreateBtn = screen.getByRole('button', { name: /^Create Token$/i });
    expect(modalCreateBtn).toBeDisabled();
  });

  it('FE-COMP-INTEGRATIONS-010: Create button in modal becomes enabled when name is typed', async () => {
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    await user.click(screen.getByRole('button', { name: /Create New Token/i }));
    await screen.findByText('Create API Token');
    const input = screen.getByPlaceholderText(/Claude Desktop/i);
    await user.type(input, 'My API token');
    const modalCreateBtn = screen.getByRole('button', { name: /^Create Token$/i });
    expect(modalCreateBtn).not.toBeDisabled();
  });

  it('FE-COMP-INTEGRATIONS-011: creating a token calls the API and shows the raw token', async () => {
    server.use(
      http.post('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          token: {
            id: 1,
            name: 'test',
            token_prefix: 'tk_abc',
            created_at: '2025-01-01T00:00:00.000Z',
            raw_token: 'tk_abc...full_secret_token',
          },
        }),
      ),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    await user.click(screen.getByRole('button', { name: /Create New Token/i }));
    await screen.findByText('Create API Token');
    const input = screen.getByPlaceholderText(/Claude Desktop/i);
    await user.type(input, 'test');
    await user.click(screen.getByRole('button', { name: /^Create Token$/i }));
    // Raw token should be displayed
    await screen.findByText(/tk_abc\.\.\.full_secret_token/);
    // Warning about one-time display
    expect(screen.getByText(/only be shown once/i)).toBeInTheDocument();
  });

  it('FE-COMP-INTEGRATIONS-012: "Done" button closes the token-created modal', async () => {
    server.use(
      http.post('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          token: {
            id: 1,
            name: 'test',
            token_prefix: 'tk_abc',
            created_at: '2025-01-01T00:00:00.000Z',
            raw_token: 'tk_abc...full_secret_token',
          },
        }),
      ),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    await user.click(screen.getByRole('button', { name: /Create New Token/i }));
    await screen.findByText('Create API Token');
    await user.type(screen.getByPlaceholderText(/Claude Desktop/i), 'test');
    await user.click(screen.getByRole('button', { name: /^Create Token$/i }));
    await screen.findByText('Token Created');
    await user.click(screen.getByRole('button', { name: /^Done$/i }));
    await waitFor(() => {
      expect(screen.queryByText('Token Created')).toBeNull();
    });
  });

  it('FE-COMP-INTEGRATIONS-013: clicking the delete button next to a token opens the confirm modal', async () => {
    server.use(
      http.get('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          tokens: [
            { id: 1, name: 'Delete Me', token_prefix: 'tk_del', created_at: '2025-01-01T00:00:00.000Z', last_used_at: null },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('Delete Me');
    await user.click(screen.getByTitle('Delete Token'));
    await screen.findByText('This token will stop working immediately. Any MCP client using it will lose access.');
    expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeInTheDocument();
  });

  it('FE-COMP-INTEGRATIONS-014: confirming deletion calls DELETE API and removes token from list', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          tokens: [
            { id: 1, name: 'Delete Me', token_prefix: 'tk_del', created_at: '2025-01-01T00:00:00.000Z', last_used_at: null },
          ],
        }),
      ),
      http.delete('/api/auth/mcp-tokens/1', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('Delete Me');
    await user.click(screen.getByTitle('Delete Token'));
    // There are two "Delete Token" buttons: the trash icon (title) and the confirm button in modal
    const deleteButtons = await screen.findAllByRole('button', { name: /^Delete Token$/i });
    // Click the one in the modal (last one, or the standalone one without title attribute)
    const confirmBtn = deleteButtons.find(btn => !btn.title);
    await user.click(confirmBtn ?? deleteButtons[deleteButtons.length - 1]);
    expect(deleteCalled).toBe(true);
    await waitFor(() => {
      expect(screen.queryByText('Delete Me')).toBeNull();
    });
  });

  it('FE-COMP-INTEGRATIONS-015: copying endpoint URL calls clipboard.writeText', async () => {
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    // Spy after userEvent.setup() may have replaced navigator.clipboard
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const copyBtns = screen.getAllByTitle('Copy');
    await user.click(copyBtns[0]);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('/mcp'));
  });

  it('FE-COMP-INTEGRATIONS-016: copy button shows checkmark icon after copy', async () => {
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const copyBtns = screen.getAllByTitle('Copy');
    await user.click(copyBtns[0]);
    await waitFor(() => {
      // After copy, icon changes to Check (green). The button should contain an svg with text-green-500
      const btn = copyBtns[0];
      const svg = btn.querySelector('svg');
      expect(svg).toHaveClass('text-green-500');
    });
  });

  it('FE-COMP-INTEGRATIONS-017: cancel button in delete confirm modal closes it without API call', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/auth/mcp-tokens', () =>
        HttpResponse.json({
          tokens: [
            { id: 1, name: 'Cancel Token', token_prefix: 'tk_can', created_at: '2025-01-01T00:00:00.000Z', last_used_at: null },
          ],
        }),
      ),
      http.delete('/api/auth/mcp-tokens/1', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('Cancel Token');
    await user.click(screen.getByTitle('Delete Token'));
    await screen.findByRole('button', { name: /^Cancel$/i });
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText('This token will stop working immediately. Any MCP client using it will lose access.')).toBeNull();
    });
    expect(deleteCalled).toBe(false);
  });

  it('FE-COMP-INTEGRATIONS-018: pressing Enter in the token name input triggers creation', async () => {
    let postCalled = false;
    server.use(
      http.post('/api/auth/mcp-tokens', () => {
        postCalled = true;
        return HttpResponse.json({
          token: {
            id: 1,
            name: 'enter-test',
            token_prefix: 'tk_ent',
            created_at: '2025-01-01T00:00:00.000Z',
            raw_token: 'tk_ent...full',
          },
        });
      }),
    );
    const user = userEvent.setup();
    enableMcp();
    render(<IntegrationsTab />);
    await screen.findByText('MCP Configuration');
    await user.click(screen.getByRole('button', { name: /Create New Token/i }));
    await screen.findByText('Create API Token');
    const input = screen.getByPlaceholderText(/Claude Desktop/i);
    await user.type(input, 'enter-test');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(postCalled).toBe(true);
    });
  });
});
