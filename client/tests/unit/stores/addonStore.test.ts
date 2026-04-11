import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import { useAddonStore } from '../../../src/store/addonStore';
import { resetAllStores } from '../../helpers/store';

beforeEach(() => {
  resetAllStores();
});

describe('addonStore', () => {
  describe('FE-ADDON-001: loadAddons()', () => {
    it('fetches and stores enabled addons', async () => {
      await useAddonStore.getState().loadAddons();
      const state = useAddonStore.getState();

      expect(state.loaded).toBe(true);
      expect(state.addons.length).toBeGreaterThan(0);
      expect(state.addons[0]).toHaveProperty('id');
      expect(state.addons[0]).toHaveProperty('enabled', true);
    });
  });

  describe('FE-ADDON-002: isEnabled returns true for known addon', () => {
    it('returns true when addon is in the list and enabled', async () => {
      await useAddonStore.getState().loadAddons();
      expect(useAddonStore.getState().isEnabled('vacay')).toBe(true);
    });
  });

  describe('FE-ADDON-003: isEnabled returns false for unknown addon', () => {
    it('returns false when addon is not in the list', async () => {
      await useAddonStore.getState().loadAddons();
      expect(useAddonStore.getState().isEnabled('nonexistent')).toBe(false);
    });
  });

  describe('FE-ADDON-004: API failure', () => {
    it('sets loaded: true and keeps addons empty on API error', async () => {
      server.use(
        http.get('/api/addons', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 })
        )
      );

      await useAddonStore.getState().loadAddons();
      const state = useAddonStore.getState();

      expect(state.loaded).toBe(true);
      expect(state.addons).toEqual([]);
    });
  });
});
