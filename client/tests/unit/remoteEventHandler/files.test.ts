import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../../../src/store/tripStore';
import { resetAllStores } from '../../helpers/store';
import { buildTripFile } from '../../helpers/factories';

beforeEach(() => {
  resetAllStores();
});

describe('remoteEventHandler > files', () => {
  const seedData = () => {
    useTripStore.setState({
      files: [buildTripFile({ id: 1, original_name: 'document.pdf' })],
    });
  };

  it('FE-WSEVT-FILE-001: file:created prepends new file to array', () => {
    seedData();
    const newFile = buildTripFile({ id: 99, original_name: 'photo.jpg' });
    useTripStore.getState().handleRemoteEvent({ type: 'file:created', file: newFile });
    const { files } = useTripStore.getState();
    expect(files).toHaveLength(2);
    expect(files[0].id).toBe(99); // prepended
  });

  it('FE-WSEVT-FILE-002: file:created is idempotent — no duplicate if same ID', () => {
    seedData();
    const duplicate = buildTripFile({ id: 1, original_name: 'document_dup.pdf' });
    useTripStore.getState().handleRemoteEvent({ type: 'file:created', file: duplicate });
    const { files } = useTripStore.getState();
    expect(files).toHaveLength(1);
    expect(files[0].original_name).toBe('document.pdf');
  });

  it('FE-WSEVT-FILE-003: file:updated replaces file in array', () => {
    seedData();
    const updated = buildTripFile({ id: 1, original_name: 'renamed.pdf' });
    useTripStore.getState().handleRemoteEvent({ type: 'file:updated', file: updated });
    const { files } = useTripStore.getState();
    expect(files[0].original_name).toBe('renamed.pdf');
  });

  it('FE-WSEVT-FILE-004: file:deleted removes file by ID', () => {
    seedData();
    useTripStore.getState().handleRemoteEvent({ type: 'file:deleted', fileId: 1 });
    const { files } = useTripStore.getState();
    expect(files).toHaveLength(0);
  });

  it('FE-WSEVT-FILE-005: file:created ordering — newest is first', () => {
    seedData();
    const f2 = buildTripFile({ id: 2, original_name: 'second.pdf' });
    const f3 = buildTripFile({ id: 3, original_name: 'third.pdf' });
    useTripStore.getState().handleRemoteEvent({ type: 'file:created', file: f2 });
    useTripStore.getState().handleRemoteEvent({ type: 'file:created', file: f3 });
    const { files } = useTripStore.getState();
    expect(files[0].id).toBe(3);
    expect(files[1].id).toBe(2);
    expect(files[2].id).toBe(1);
  });
});
