import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildTodoItem } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > todo', () => {
  const seedData = () => {
    useTripStore.setState({
      todoItems: [buildTodoItem({ id: 1, name: 'Book flights' })],
    });
  };

  it('FE-WSEVT-TODO-001: todo:created adds item to todoItems', () => {
    seedData();
    const newItem = buildTodoItem({ id: 99, name: 'Pack bags' });
    useTripStore.getState().handleRemoteEvent({ type: 'todo:created', item: newItem });
    const { todoItems } = useTripStore.getState();
    expect(todoItems).toHaveLength(2);
    expect(todoItems.find(i => i.id === 99)).toBeDefined();
  });

  it('FE-WSEVT-TODO-002: todo:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildTodoItem({ id: 1, name: 'Book flights duplicate' });
    useTripStore.getState().handleRemoteEvent({ type: 'todo:created', item: duplicate });
    const { todoItems } = useTripStore.getState();
    expect(todoItems).toHaveLength(1);
    expect(todoItems[0].name).toBe('Book flights');
  });

  it('FE-WSEVT-TODO-003: todo:updated replaces item in array', () => {
    seedData();
    const updated = buildTodoItem({ id: 1, name: 'Book round-trip flights' });
    useTripStore.getState().handleRemoteEvent({ type: 'todo:updated', item: updated });
    const { todoItems } = useTripStore.getState();
    expect(todoItems[0].name).toBe('Book round-trip flights');
  });

  it('FE-WSEVT-TODO-004: todo:deleted removes item by ID', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'todo:deleted', itemId: 1 });
    const { todoItems } = useTripStore.getState();
    expect(todoItems).toHaveLength(0);
  });
});
