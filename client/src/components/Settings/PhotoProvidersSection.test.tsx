// FE-COMP-PHOTOPROVIDERS-001 to FE-COMP-PHOTOPROVIDERS-018
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useAddonStore } from '../../store/addonStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser } from '../../../tests/helpers/factories';
import { ToastContainer } from '../shared/Toast';
import PhotoProvidersSection from './PhotoProvidersSection';

const fakeProvider = {
  id: 'immich',
  name: 'Immich',
  type: 'photo_provider',
  enabled: true,
  config: {
    settings_get: '/addons/immich/settings',
    settings_put: '/addons/immich/settings',
    status_get: '/addons/immich/status',
    test_post: '/addons/immich/test',
  },
  fields: [
    { key: 'url', label: 'url', input_type: 'text', placeholder: 'https://...', required: true, secret: false, settings_key: 'url', payload_key: 'url', sort_order: 0 },
    { key: 'api_key', label: 'api_key', input_type: 'text', placeholder: null, required: true, secret: true, settings_key: 'api_key', payload_key: 'api_key', sort_order: 1 },
  ],
};

// A simpler provider with only a non-secret required field (url), useful for Save tests
const fakeProviderSimple = {
  ...fakeProvider,
  fields: [fakeProvider.fields[0]], // only the url field
};

function seedMemoriesEnabled(providers = [fakeProvider]) {
  seedStore(useAddonStore, {
    addons: [
      { id: 'memories', type: 'memories', enabled: true },
      ...providers,
    ],
    isEnabled: (id: string) => id === 'memories' || providers.some(p => p.id === id),
  });
}

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useAddonStore, {
    addons: [],
    isEnabled: () => false,
  });
  server.use(
    http.get('/api/addons/immich/settings', () => HttpResponse.json({ url: 'https://photos.example.com', connected: false })),
    http.get('/api/addons/immich/status', () => HttpResponse.json({ connected: false })),
    http.put('/api/addons/immich/settings', () => HttpResponse.json({ success: true })),
    http.post('/api/addons/immich/test', () => HttpResponse.json({ connected: true })),
  );
});

describe('PhotoProvidersSection', () => {
  it('FE-COMP-PHOTOPROVIDERS-001: renders nothing when memories addon is disabled', () => {
    const { container } = render(<PhotoProvidersSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('FE-COMP-PHOTOPROVIDERS-002: renders nothing when there are no active photo providers', async () => {
    seedStore(useAddonStore, {
      addons: [{ id: 'memories', type: 'memories', enabled: true }],
      isEnabled: (id: string) => id === 'memories',
    });
    const { container } = render(<PhotoProvidersSection />);
    // Give the component a moment to potentially render something
    await new Promise(r => setTimeout(r, 50));
    expect(container.querySelector('section, [class*="section"]')).toBeNull();
    expect(screen.queryByText('Immich')).toBeNull();
  });

  it('FE-COMP-PHOTOPROVIDERS-003: renders a section card for each active provider', async () => {
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
  });

  it('FE-COMP-PHOTOPROVIDERS-004: renders field inputs for each provider field', async () => {
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('FE-COMP-PHOTOPROVIDERS-005: non-secret field is prefilled with value from settings API', async () => {
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByDisplayValue('https://photos.example.com');
  });

  it('FE-COMP-PHOTOPROVIDERS-006: secret field is NOT prefilled (blank value)', async () => {
    server.use(
      http.get('/api/addons/immich/settings', () =>
        HttpResponse.json({ url: 'https://photos.example.com', api_key: 'super-secret-key', connected: false }),
      ),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    await screen.findByDisplayValue('https://photos.example.com');
    // api_key field should remain blank
    const inputs = screen.getAllByRole('textbox');
    const apiKeyInput = inputs.find(i => (i as HTMLInputElement).value === '');
    expect(apiKeyInput).toBeDefined();
    expect((apiKeyInput as HTMLInputElement).value).toBe('');
  });

  it('FE-COMP-PHOTOPROVIDERS-007: secret field shows masked placeholder when connected', async () => {
    server.use(
      http.get('/api/addons/immich/settings', () =>
        HttpResponse.json({ url: 'https://photos.example.com', connected: true }),
      ),
      http.get('/api/addons/immich/status', () => HttpResponse.json({ connected: true })),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      const maskedInput = inputs.find(i => (i as HTMLInputElement).placeholder === '••••••••');
      expect(maskedInput).toBeDefined();
    });
  });

  it('FE-COMP-PHOTOPROVIDERS-008: Save button is disabled when required non-secret field is empty', async () => {
    server.use(
      http.get('/api/addons/immich/settings', () => HttpResponse.json({ url: '', connected: false })),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  it('FE-COMP-PHOTOPROVIDERS-009: Save button is enabled when all required fields are filled', async () => {
    const user = userEvent.setup();
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    // url is prefilled, but api_key (required + secret) must also be filled
    await screen.findByDisplayValue('https://photos.example.com');
    const inputs = screen.getAllByRole('textbox');
    const apiKeyInput = inputs.find(i => (i as HTMLInputElement).value === '') as HTMLInputElement;
    await user.type(apiKeyInput, 'some-api-key');
    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it('FE-COMP-PHOTOPROVIDERS-010: clicking Save calls PUT settings endpoint', async () => {
    const user = userEvent.setup();
    let putCalled = false;
    server.use(
      http.put('/api/addons/immich/settings', () => {
        putCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    seedMemoriesEnabled([fakeProviderSimple]);
    render(<PhotoProvidersSection />);
    await screen.findByDisplayValue('https://photos.example.com');
    const saveBtn = await screen.findByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);
    await waitFor(() => expect(putCalled).toBe(true));
  });

  it('FE-COMP-PHOTOPROVIDERS-011: successful save shows success toast', async () => {
    const user = userEvent.setup();
    seedMemoriesEnabled([fakeProviderSimple]);
    render(
      <>
        <ToastContainer />
        <PhotoProvidersSection />
      </>,
    );
    await screen.findByDisplayValue('https://photos.example.com');
    const saveBtn = await screen.findByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);
    await screen.findByText(/immich settings saved/i);
  });

  it('FE-COMP-PHOTOPROVIDERS-012: failed save shows error toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/addons/immich/settings', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    );
    seedMemoriesEnabled([fakeProviderSimple]);
    render(
      <>
        <ToastContainer />
        <PhotoProvidersSection />
      </>,
    );
    await screen.findByDisplayValue('https://photos.example.com');
    const saveBtn = await screen.findByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);
    await screen.findByText(/could not save immich/i);
  });

  it('FE-COMP-PHOTOPROVIDERS-013: clicking Test Connection calls the test endpoint', async () => {
    const user = userEvent.setup();
    let testCalled = false;
    server.use(
      http.post('/api/addons/immich/test', () => {
        testCalled = true;
        return HttpResponse.json({ connected: true });
      }),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    await user.click(testBtn);
    await waitFor(() => expect(testCalled).toBe(true));
  });

  it('FE-COMP-PHOTOPROVIDERS-014: successful test shows "Connected" badge', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/addons/immich/test', () => HttpResponse.json({ connected: true })),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    await user.click(testBtn);
    await screen.findByText(/connected/i);
  });

  it('FE-COMP-PHOTOPROVIDERS-015: failed test shows error toast', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/addons/immich/test', () => HttpResponse.json({ connected: false, error: 'Auth failed' })),
    );
    seedMemoriesEnabled();
    render(
      <>
        <ToastContainer />
        <PhotoProvidersSection />
      </>,
    );
    await screen.findByText('Immich');
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    await user.click(testBtn);
    await screen.findByText(/Auth failed/i);
  });

  it('FE-COMP-PHOTOPROVIDERS-016: Test button is disabled while test is in progress', async () => {
    const user = userEvent.setup();
    let resolveTest!: () => void;
    server.use(
      http.post('/api/addons/immich/test', async () => {
        await new Promise<void>(resolve => {
          resolveTest = resolve;
        });
        return HttpResponse.json({ connected: true });
      }),
    );
    seedMemoriesEnabled();
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    const testBtn = screen.getByRole('button', { name: /test connection/i });
    await user.click(testBtn);
    await waitFor(() => expect(testBtn).toBeDisabled());
    resolveTest();
    await waitFor(() => expect(testBtn).not.toBeDisabled());
  });

  it('FE-COMP-PHOTOPROVIDERS-017: Save button is disabled while saving', async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    server.use(
      http.put('/api/addons/immich/settings', async () => {
        await new Promise<void>(resolve => {
          resolveSave = resolve;
        });
        return HttpResponse.json({ success: true });
      }),
    );
    seedMemoriesEnabled([fakeProviderSimple]);
    render(<PhotoProvidersSection />);
    await screen.findByDisplayValue('https://photos.example.com');
    const saveBtn = await screen.findByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);
    await waitFor(() => expect(saveBtn).toBeDisabled());
    resolveSave();
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });

  it('FE-COMP-PHOTOPROVIDERS-018: multiple providers each get their own Section card', async () => {
    const secondProvider = {
      id: 'piwigo',
      name: 'Piwigo',
      type: 'photo_provider',
      enabled: true,
      config: {
        settings_get: '/addons/piwigo/settings',
        settings_put: '/addons/piwigo/settings',
        status_get: '/addons/piwigo/status',
        test_post: '/addons/piwigo/test',
      },
      fields: [
        { key: 'url', label: 'url', input_type: 'text', placeholder: 'https://...', required: true, secret: false, settings_key: 'url', payload_key: 'url', sort_order: 0 },
      ],
    };
    server.use(
      http.get('/api/addons/piwigo/settings', () => HttpResponse.json({ url: '', connected: false })),
      http.get('/api/addons/piwigo/status', () => HttpResponse.json({ connected: false })),
    );
    seedMemoriesEnabled([fakeProvider, secondProvider]);
    render(<PhotoProvidersSection />);
    await screen.findByText('Immich');
    await screen.findByText('Piwigo');
  });
});
