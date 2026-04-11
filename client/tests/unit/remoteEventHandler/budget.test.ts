import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildBudgetItem } from '../../helpers/factories';
import type { BudgetMember } from '../../../src/types';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > budget', () => {
  const member1: BudgetMember = { user_id: 5, paid: false };
  const member2: BudgetMember = { user_id: 6, paid: true };

  const seedData = () => {
    useTripStore.setState({
      budgetItems: [
        buildBudgetItem({ id: 1, persons: 1, members: [{ ...member1 }] }),
        buildBudgetItem({ id: 2, persons: 2, members: [{ ...member2 }] }),
      ],
    });
  };

  it('FE-WSEVT-BUDGET-001: budget:created adds item to budgetItems', () => {
    seedData();
    const newItem = buildBudgetItem({ id: 99, name: 'Hotel' });
    useTripStore.getState().handleRemoteEvent({ type: 'budget:created', item: newItem });
    const { budgetItems } = useTripStore.getState();
    expect(budgetItems).toHaveLength(3);
    expect(budgetItems.find(i => i.id === 99)).toBeDefined();
  });

  it('FE-WSEVT-BUDGET-002: budget:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildBudgetItem({ id: 1, name: 'Duplicate' });
    useTripStore.getState().handleRemoteEvent({ type: 'budget:created', item: duplicate });
    const { budgetItems } = useTripStore.getState();
    expect(budgetItems).toHaveLength(2);
  });

  it('FE-WSEVT-BUDGET-003: budget:updated replaces item in array', () => {
    seedData();
    const updated = buildBudgetItem({ id: 1, name: 'Updated Hotel', amount: 500 });
    useTripStore.getState().handleRemoteEvent({ type: 'budget:updated', item: updated });
    const { budgetItems } = useTripStore.getState();
    const item = budgetItems.find(i => i.id === 1);
    expect(item?.name).toBe('Updated Hotel');
    expect(item?.amount).toBe(500);
  });

  it('FE-WSEVT-BUDGET-004: budget:deleted removes item by ID', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'budget:deleted', itemId: 1 });
    const { budgetItems } = useTripStore.getState();
    expect(budgetItems).toHaveLength(1);
    expect(budgetItems.find(i => i.id === 1)).toBeUndefined();
  });

  it('FE-WSEVT-BUDGET-005: budget:members-updated replaces entire members array and persons count', () => {
    seedData();
    const newMembers: BudgetMember[] = [{ user_id: 7, paid: true }, { user_id: 8, paid: false }];
    useTripStore.getState().handleRemoteEvent({
      type: 'budget:members-updated',
      itemId: 1,
      members: newMembers,
      persons: 3,
    });
    const { budgetItems } = useTripStore.getState();
    const item = budgetItems.find(i => i.id === 1);
    expect(item?.members).toEqual(newMembers);
    expect(item?.persons).toBe(3);
    // Other item should be unchanged
    const item2 = budgetItems.find(i => i.id === 2);
    expect(item2?.members).toEqual([{ ...member2 }]);
  });

  it('FE-WSEVT-BUDGET-006: budget:member-paid-updated toggles specific member paid status', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({
      type: 'budget:member-paid-updated',
      itemId: 1,
      userId: 5,
      paid: true,
    });
    const { budgetItems } = useTripStore.getState();
    const item = budgetItems.find(i => i.id === 1);
    const m = item?.members?.find(m => m.user_id === 5);
    expect(m?.paid).toBe(true);
    // Other item members unchanged
    const item2 = budgetItems.find(i => i.id === 2);
    expect(item2?.members?.[0].paid).toBe(true);
  });
});
