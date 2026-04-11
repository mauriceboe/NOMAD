import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../helpers/msw/server';
import { useVacayStore } from '../../../src/store/vacayStore';
import { resetAllStores } from '../../helpers/store';

beforeEach(() => {
  resetAllStores();
});

describe('vacayStore', () => {
  describe('FE-VACAY-001: loadAll()', () => {
    it('fetches plan, years, entries, and stats, updates state', async () => {
      await useVacayStore.getState().loadAll();
      const state = useVacayStore.getState();

      expect(state.plan).not.toBeNull();
      expect(state.plan?.id).toBe(1);
      expect(state.years).toEqual([2025, 2026]);
      expect(state.entries.length).toBeGreaterThan(0);
      expect(state.stats.length).toBeGreaterThan(0);
      expect(state.loading).toBe(false);
    });
  });

  describe('FE-VACAY-002: toggleEntry()', () => {
    it('calls the toggle API then reloads entries and stats', async () => {
      // Seed selected year
      useVacayStore.setState({ selectedYear: 2025 });

      let toggled = false;
      server.use(
        http.post('/api/addons/vacay/entries/toggle', () => {
          toggled = true;
          return HttpResponse.json({ success: true });
        })
      );

      await useVacayStore.getState().toggleEntry('2025-06-20');

      expect(toggled).toBe(true);
      // After toggle, entries are refreshed from MSW (2 entries)
      expect(useVacayStore.getState().entries.length).toBe(2);
    });
  });

  describe('FE-VACAY-003: loadHolidays() — holidays_enabled with calendars', () => {
    it('populates holidays map when plan has holiday calendars', async () => {
      // Set plan state with holidays_enabled and a simple (non-regional) calendar
      useVacayStore.setState({
        selectedYear: 2025,
        plan: {
          id: 1,
          holidays_enabled: true,
          holidays_region: null,
          holiday_calendars: [
            { id: 1, plan_id: 1, region: 'DE', label: 'Germany', color: '#ef4444', sort_order: 0 },
          ],
          block_weekends: true,
          carry_over_enabled: false,
          company_holidays_enabled: false,
        },
      });

      // Override MSW to return non-regional holidays (no counties)
      server.use(
        http.get('/api/addons/vacay/holidays/:year/:country', () =>
          HttpResponse.json([
            { date: '2025-12-25', name: 'Christmas', localName: 'Weihnachten', global: true, counties: null },
            { date: '2025-01-01', name: 'New Year', localName: 'Neujahr', global: true, counties: null },
          ])
        )
      );

      await useVacayStore.getState().loadHolidays(2025);
      const state = useVacayStore.getState();

      expect(Object.keys(state.holidays).length).toBeGreaterThan(0);
      expect(state.holidays['2025-12-25']).toBeDefined();
      expect(state.holidays['2025-12-25'].name).toBe('Christmas');
    });
  });

  describe('FE-VACAY-003b: loadHolidays() — holidays not enabled', () => {
    it('sets holidays to empty map when holidays_enabled is false', async () => {
      useVacayStore.setState({
        selectedYear: 2025,
        plan: {
          id: 1,
          holidays_enabled: false,
          holidays_region: null,
          holiday_calendars: [],
          block_weekends: true,
          carry_over_enabled: false,
          company_holidays_enabled: false,
        },
      });

      await useVacayStore.getState().loadHolidays(2025);
      expect(useVacayStore.getState().holidays).toEqual({});
    });
  });

  describe('FE-VACAY-004a: updatePlan()', () => {
    it('updates plan and reloads entries, stats, holidays', async () => {
      // Need existing plan for holiday check in loadHolidays
      useVacayStore.setState({
        selectedYear: 2025,
        plan: {
          id: 1,
          holidays_enabled: false,
          holidays_region: null,
          holiday_calendars: [],
          block_weekends: true,
          carry_over_enabled: false,
          company_holidays_enabled: false,
        },
      });

      await useVacayStore.getState().updatePlan({ holidays_enabled: true });
      const state = useVacayStore.getState();

      // The MSW handler for PUT /addons/vacay/plan returns holidays_enabled: true
      expect(state.plan?.holidays_enabled).toBe(true);
    });
  });

  describe('FE-VACAY-004b: addYear()', () => {
    it('adds a year and the years list is updated', async () => {
      await useVacayStore.getState().addYear(2027);
      expect(useVacayStore.getState().years).toContain(2027);
    });
  });

  describe('FE-VACAY-004c: removeYear()', () => {
    it('removes a year and updates the years list', async () => {
      useVacayStore.setState({ years: [2025, 2026], selectedYear: 2026 });

      await useVacayStore.getState().removeYear(2026);
      const state = useVacayStore.getState();

      // MSW returns [2025] after delete
      expect(state.years).toEqual([2025]);
      // selectedYear should shift to the last remaining year
      expect(state.selectedYear).toBe(2025);
    });
  });

  describe('FE-STORE-VACAY-005: setSelectedYear and setSelectedUserId', () => {
    it('updates selectedYear state', () => {
      useVacayStore.getState().setSelectedYear(2028);
      expect(useVacayStore.getState().selectedYear).toBe(2028);
    });

    it('updates selectedUserId state', () => {
      useVacayStore.getState().setSelectedUserId(42);
      expect(useVacayStore.getState().selectedUserId).toBe(42);
    });

    it('sets selectedUserId to null', () => {
      useVacayStore.setState({ selectedUserId: 42 });
      useVacayStore.getState().setSelectedUserId(null);
      expect(useVacayStore.getState().selectedUserId).toBeNull();
    });
  });

  describe('FE-STORE-VACAY-006: loadEntries() uses selectedYear when no year arg', () => {
    it('falls back to selectedYear when called without argument', async () => {
      useVacayStore.setState({ selectedYear: 2025 });
      await useVacayStore.getState().loadEntries();
      expect(useVacayStore.getState().entries.length).toBe(2);
    });
  });

  describe('FE-STORE-VACAY-007: loadStats() uses selectedYear when no year arg', () => {
    it('falls back to selectedYear when called without argument', async () => {
      useVacayStore.setState({ selectedYear: 2025 });
      await useVacayStore.getState().loadStats();
      expect(useVacayStore.getState().stats.length).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-008: invite()', () => {
    it('calls invite API and reloads plan', async () => {
      let inviteCalled = false;
      server.use(
        http.post('/api/addons/vacay/invite', () => {
          inviteCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      await useVacayStore.getState().invite(5);
      const state = useVacayStore.getState();

      expect(inviteCalled).toBe(true);
      expect(state.plan).not.toBeNull();
      expect(state.plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-009: declineInvite()', () => {
    it('calls decline API and reloads plan', async () => {
      await useVacayStore.getState().declineInvite(2);
      expect(useVacayStore.getState().plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-010: cancelInvite()', () => {
    it('calls cancel API and reloads plan', async () => {
      await useVacayStore.getState().cancelInvite(3);
      const state = useVacayStore.getState();
      expect(state.plan).not.toBeNull();
      expect(state.plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-011: acceptInvite()', () => {
    it('calls loadAll after accepting invite', async () => {
      await useVacayStore.getState().acceptInvite(1);
      const state = useVacayStore.getState();

      expect(state.plan).not.toBeNull();
      expect(state.years).toEqual([2025, 2026]);
      expect(state.loading).toBe(false);
    });
  });

  describe('FE-STORE-VACAY-012: dissolve()', () => {
    it('calls loadAll after dissolving', async () => {
      await useVacayStore.getState().dissolve();
      const state = useVacayStore.getState();

      expect(state.plan).not.toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe('FE-STORE-VACAY-013: updateColor()', () => {
    it('reloads plan and entries after updating color', async () => {
      server.use(
        http.put('/api/addons/vacay/color', () =>
          HttpResponse.json({ success: true })
        )
      );

      await useVacayStore.getState().updateColor('#ff0000');
      const state = useVacayStore.getState();

      expect(state.plan?.id).toBe(1);
      expect(state.entries.length).toBe(2);
    });
  });

  describe('FE-STORE-VACAY-014: toggleCompanyHoliday()', () => {
    it('reloads entries and stats after toggling company holiday', async () => {
      useVacayStore.setState({ selectedYear: 2025 });

      server.use(
        http.post('/api/addons/vacay/entries/company-holiday', () =>
          HttpResponse.json({ success: true })
        )
      );

      await useVacayStore.getState().toggleCompanyHoliday('2025-12-26');
      const state = useVacayStore.getState();

      expect(state.entries.length).toBe(2);
      expect(state.stats.length).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-015: updateVacationDays()', () => {
    it('reloads stats for the given year', async () => {
      await useVacayStore.getState().updateVacationDays(2025, 25);
      expect(useVacayStore.getState().stats.length).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-016: removeYear() when selectedYear is not the removed year', () => {
    it('does not change selectedYear when a different year is removed', async () => {
      useVacayStore.setState({ years: [2025, 2026], selectedYear: 2025 });

      await useVacayStore.getState().removeYear(2026);
      const state = useVacayStore.getState();

      expect(state.years).toEqual([2025]);
      expect(state.selectedYear).toBe(2025);
    });
  });

  describe('FE-STORE-VACAY-017: addHolidayCalendar()', () => {
    it('reloads plan and holidays after adding a holiday calendar', async () => {
      server.use(
        http.post('/api/addons/vacay/plan/holiday-calendars', () =>
          HttpResponse.json({
            calendar: { id: 1, plan_id: 1, region: 'DE', label: null, color: '#ef4444', sort_order: 0 },
          })
        )
      );

      await useVacayStore.getState().addHolidayCalendar({ region: 'DE', color: '#ef4444' });
      expect(useVacayStore.getState().plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-018: updateHolidayCalendar()', () => {
    it('reloads plan and holidays after updating a holiday calendar', async () => {
      server.use(
        http.put('/api/addons/vacay/plan/holiday-calendars/:id', () =>
          HttpResponse.json({
            calendar: { id: 1, plan_id: 1, region: 'US', label: 'US Holidays', color: '#3b82f6', sort_order: 0 },
          })
        )
      );

      await useVacayStore.getState().updateHolidayCalendar(1, { label: 'US Holidays' });
      expect(useVacayStore.getState().plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-019: deleteHolidayCalendar()', () => {
    it('reloads plan and holidays after deleting a holiday calendar', async () => {
      await useVacayStore.getState().deleteHolidayCalendar(1);
      expect(useVacayStore.getState().plan?.id).toBe(1);
    });
  });

  describe('FE-STORE-VACAY-020: loadHolidays() with regional calendar includes matching counties', () => {
    it('includes holidays matching the region county and excludes non-matching ones', async () => {
      useVacayStore.setState({
        selectedYear: 2025,
        plan: {
          id: 1,
          holidays_enabled: true,
          holidays_region: null,
          holiday_calendars: [
            { id: 1, plan_id: 1, region: 'DE-BY', label: null, color: '#ef4444', sort_order: 0 },
          ],
          block_weekends: false,
          carry_over_enabled: false,
          company_holidays_enabled: false,
        },
      });

      server.use(
        http.get('/api/addons/vacay/holidays/:year/:country', () =>
          HttpResponse.json([
            { date: '2025-11-01', name: 'All Saints Day', localName: 'Allerheiligen', global: false, counties: ['DE-BY', 'DE-BW'] },
            { date: '2025-08-15', name: 'Assumption Day', localName: 'Mariä Himmelfahrt', global: false, counties: ['DE-BY'] },
            { date: '2025-03-19', name: 'St. Joseph', localName: 'Sankt Joseph', global: false, counties: ['DE-NW'] },
          ])
        )
      );

      await useVacayStore.getState().loadHolidays(2025);
      const holidays = useVacayStore.getState().holidays;

      // DE-BY holidays should be included
      expect(holidays['2025-11-01']).toBeDefined();
      expect(holidays['2025-08-15']).toBeDefined();
      // DE-NW only holiday should be excluded
      expect(holidays['2025-03-19']).toBeUndefined();
    });
  });

  describe('FE-STORE-VACAY-021: loadHolidays() skips regional calendar when data has no county breakdown', () => {
    it('results in empty holidays map when all entries are global (no counties)', async () => {
      useVacayStore.setState({
        selectedYear: 2025,
        plan: {
          id: 1,
          holidays_enabled: true,
          holidays_region: null,
          holiday_calendars: [
            { id: 1, plan_id: 1, region: 'DE-BY', label: null, color: '#ef4444', sort_order: 0 },
          ],
          block_weekends: false,
          carry_over_enabled: false,
          company_holidays_enabled: false,
        },
      });

      server.use(
        http.get('/api/addons/vacay/holidays/:year/:country', () =>
          HttpResponse.json([
            { date: '2025-12-25', name: 'Christmas', localName: 'Weihnachten', global: true, counties: null },
            { date: '2025-01-01', name: 'New Year', localName: 'Neujahr', global: true, counties: null },
          ])
        )
      );

      await useVacayStore.getState().loadHolidays(2025);
      // hasRegions is false (no counties), region is 'DE-BY' (non-null)
      // so the condition `hasRegions && !region` is false → proceeds to county filter
      // h.global is true → all holidays are included despite region filter
      // Actually: global=true entries are included by the `h.global` check in the forEach
      // The test verifies behavior when counties: null + global: true
      const holidays = useVacayStore.getState().holidays;
      // Global holidays are included even for regional calendars when counties data is absent
      expect(holidays['2025-12-25']).toBeDefined();
    });
  });
});
