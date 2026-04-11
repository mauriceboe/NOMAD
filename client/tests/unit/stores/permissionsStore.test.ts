import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissionsStore, useCanDo } from '../../../src/store/permissionsStore';
import { useAuthStore } from '../../../src/store/authStore';
import { resetAllStores } from '../../helpers/store';
import { buildUser, buildAdmin } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('permissionsStore', () => {
  describe('FE-PERMS-001: setPermissions()', () => {
    it('stores the permission map', () => {
      const perms = { trip_create: 'everybody', file_upload: 'trip_member' } as const;
      usePermissionsStore.getState().setPermissions(perms);

      expect(usePermissionsStore.getState().permissions).toEqual(perms);
    });
  });

  describe('FE-PERMS-002: useCanDo() — basic allow/deny', () => {
    it('returns false when user is not authenticated', () => {
      usePermissionsStore.getState().setPermissions({ trip_create: 'everybody' });

      const { result } = renderHook(() => useCanDo());
      expect(result.current('trip_create')).toBe(false);
    });

    it('returns true for "everybody" when user is authenticated', () => {
      useAuthStore.setState({ user: buildUser(), isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ trip_create: 'everybody' });

      const { result } = renderHook(() => useCanDo());
      expect(result.current('trip_create')).toBe(true);
    });

    it('returns true when action has no configured permission (default allow)', () => {
      useAuthStore.setState({ user: buildUser(), isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({});

      const { result } = renderHook(() => useCanDo());
      expect(result.current('unconfigured_action')).toBe(true);
    });
  });

  describe('Admin user', () => {
    it('can do anything regardless of configured permissions', () => {
      useAuthStore.setState({ user: buildAdmin(), isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ restricted_action: 'admin' });

      const { result } = renderHook(() => useCanDo());
      expect(result.current('restricted_action')).toBe(true);
    });
  });

  describe('Owner permissions', () => {
    it('trip_owner level: owner can act, member cannot', () => {
      const user = buildUser({ id: 42 });
      useAuthStore.setState({ user, isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ delete_trip: 'trip_owner' });

      const { result } = renderHook(() => useCanDo());
      const trip = { owner_id: 42 };      // user is owner
      const otherTrip = { owner_id: 99 }; // user is not owner

      expect(result.current('delete_trip', trip)).toBe(true);
      expect(result.current('delete_trip', otherTrip)).toBe(false);
    });

    it('trip_owner level: is_owner flag grants access', () => {
      const user = buildUser({ id: 1 });
      useAuthStore.setState({ user, isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ delete_trip: 'trip_owner' });

      const { result } = renderHook(() => useCanDo());
      expect(result.current('delete_trip', { is_owner: true })).toBe(true);
      expect(result.current('delete_trip', { is_owner: false })).toBe(false);
    });
  });

  describe('Member permissions', () => {
    it('trip_member level: members and owners can act, unauthenticated trip context cannot', () => {
      const user = buildUser({ id: 1 });
      useAuthStore.setState({ user, isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ upload_file: 'trip_member' });

      const { result } = renderHook(() => useCanDo());
      const asOwner = { owner_id: 1 };       // user is owner
      const asMember = { owner_id: 99 };     // user is member (trip context provided, not owner)
      const noTrip = null;                   // no trip context

      expect(result.current('upload_file', asOwner)).toBe(true);
      expect(result.current('upload_file', asMember)).toBe(true);
      expect(result.current('upload_file', noTrip)).toBe(false);
    });
  });

  describe('Nobody / admin-only level', () => {
    it('admin level: regular user is denied even as trip owner', () => {
      const user = buildUser({ id: 1 });
      useAuthStore.setState({ user, isAuthenticated: true });
      usePermissionsStore.getState().setPermissions({ admin_action: 'admin' });

      const { result } = renderHook(() => useCanDo());
      expect(result.current('admin_action', { owner_id: 1 })).toBe(false);
      expect(result.current('admin_action')).toBe(false);
    });
  });
});
