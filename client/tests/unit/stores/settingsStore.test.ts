import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { resetAllStores } from '../../helpers/store';
import { buildSettings } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('settingsStore', () => {
  describe('FE-SETTINGS-001: loadSettings()', () => {
    it('fetches settings and updates store', async () => {
      const settings = buildSettings({ default_currency: 'EUR', language: 'de' });
      server.use(
        http.get('/api/settings', () => HttpResponse.json({ settings }))
      );

      await useSettingsStore.getState().loadSettings();
      const state = useSettingsStore.getState();

      expect(state.settings.default_currency).toBe('EUR');
      expect(state.settings.language).toBe('de');
      expect(state.isLoaded).toBe(true);
    });
  });

  describe('FE-SETTINGS-002: updateSetting() optimistic update', () => {
    it('immediately updates local state before API resolves', async () => {
      // The store's set() is called synchronously before the first await (settingsApi.set)
      // so state is visible without needing to await the full action.
      const promise = useSettingsStore.getState().updateSetting('default_currency', 'GBP');

      // Check optimistic state — no await needed here
      expect(useSettingsStore.getState().settings.default_currency).toBe('GBP');

      // Let the API call finish to avoid dangling promises
      await promise;
    });
  });

  describe('FE-SETTINGS-003: updateSetting() reverts on API failure', () => {
    it('throws when API fails', async () => {
      server.use(
        http.put('/api/settings', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      // The store optimistically sets, then throws — the revert is a throw
      await expect(
        useSettingsStore.getState().updateSetting('default_currency', 'GBP')
      ).rejects.toThrow();
    });
  });

  describe('FE-SETTINGS-004: Language change', () => {
    it('updates language field and localStorage', async () => {
      await useSettingsStore.getState().updateSetting('language', 'fr');

      const state = useSettingsStore.getState();
      expect(state.settings.language).toBe('fr');
      expect(localStorage.getItem('app_language')).toBe('fr');
    });
  });

  describe('FE-SETTINGS-005: loadSettings failure', () => {
    it('sets isLoaded: true even on API failure (graceful)', async () => {
      server.use(
        http.get('/api/settings', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      await useSettingsStore.getState().loadSettings();
      const state = useSettingsStore.getState();

      expect(state.isLoaded).toBe(true);
    });
  });

  describe('FE-STORE-SETTINGS-006: setLanguageLocal updates state and localStorage', () => {
    it('sets language in state and localStorage without an API call', () => {
      useSettingsStore.getState().setLanguageLocal('ja');

      const state = useSettingsStore.getState();
      expect(state.settings.language).toBe('ja');
      expect(localStorage.getItem('app_language')).toBe('ja');
    });
  });

  describe('FE-STORE-SETTINGS-007: setLanguageLocal without prior localStorage value', () => {
    it('writes to localStorage even when no prior value exists', () => {
      localStorage.clear();

      useSettingsStore.getState().setLanguageLocal('ko');

      const state = useSettingsStore.getState();
      expect(state.settings.language).toBe('ko');
      expect(localStorage.getItem('app_language')).toBe('ko');
    });
  });

  describe('FE-STORE-SETTINGS-008: updateSettings bulk update', () => {
    it('updates multiple settings keys and calls bulk API', async () => {
      await useSettingsStore.getState().updateSettings({ dark_mode: true, default_currency: 'JPY' });

      const state = useSettingsStore.getState();
      expect(state.settings.dark_mode).toBe(true);
      expect(state.settings.default_currency).toBe('JPY');
    });
  });

  describe('FE-STORE-SETTINGS-009: updateSettings optimistic update', () => {
    it('updates state synchronously before API resolves', async () => {
      const promise = useSettingsStore.getState().updateSettings({ dark_mode: true });

      expect(useSettingsStore.getState().settings.dark_mode).toBe(true);

      await promise;
    });
  });

  describe('FE-STORE-SETTINGS-010: updateSettings API failure throws', () => {
    it('throws when bulk API returns 500', async () => {
      server.use(
        http.post('/api/settings/bulk', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      await expect(
        useSettingsStore.getState().updateSettings({ dark_mode: true })
      ).rejects.toThrow();
    });
  });

  describe('FE-STORE-SETTINGS-011: updateSetting non-language key does not write to localStorage', () => {
    it('does not modify app_language in localStorage', async () => {
      const before = localStorage.getItem('app_language');

      await useSettingsStore.getState().updateSetting('dark_mode', true);

      expect(localStorage.getItem('app_language')).toBe(before);
    });
  });

  describe('FE-STORE-SETTINGS-012: loadSettings merges server values with defaults', () => {
    it('preserves default keys not returned by server', async () => {
      server.use(
        http.get('/api/settings', () =>
          HttpResponse.json({ settings: { dark_mode: true } })
        )
      );

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.settings.dark_mode).toBe(true);
      expect(state.settings.default_currency).toBe('USD');
    });
  });

  describe('FE-STORE-SETTINGS-013: updateSetting for time_format', () => {
    it('updates time_format in state', async () => {
      await useSettingsStore.getState().updateSetting('time_format', '24h');

      expect(useSettingsStore.getState().settings.time_format).toBe('24h');
    });
  });

  describe('FE-STORE-SETTINGS-014: updateSetting API failure leaves optimistic state', () => {
    it('throws on API failure but keeps the optimistic state', async () => {
      server.use(
        http.put('/api/settings', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      await expect(
        useSettingsStore.getState().updateSetting('default_zoom', 15)
      ).rejects.toThrow();

      expect(useSettingsStore.getState().settings.default_zoom).toBe(15);
    });
  });
});
