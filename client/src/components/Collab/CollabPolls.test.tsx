// FE-COMP-POLLS-001 to FE-COMP-POLLS-015

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip } from '../../../tests/helpers/factories';
import CollabPolls from './CollabPolls';
import { addListener } from '../../api/websocket';

const currentUser = buildUser({ id: 1, username: 'testuser' });

const buildPoll = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  question: 'Best destination?',
  options: [
    { id: 1, text: 'Paris', label: 'Paris', voters: [] },
    { id: 2, text: 'Rome', label: 'Rome', voters: [] },
  ],
  multi_choice: false,
  is_closed: false,
  deadline: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  ...overrides,
});

const defaultProps = { tripId: 1, currentUser };

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
  server.use(
    http.get('/api/trips/1/collab/polls', () =>
      HttpResponse.json({ polls: [] }),
    ),
  );
  seedStore(useAuthStore, { user: currentUser, isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1, owner_id: 1 }) });
});

describe('CollabPolls', () => {
  it('FE-COMP-POLLS-001: renders empty state when no polls exist', async () => {
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);
  });

  it('FE-COMP-POLLS-002: shows loading spinner initially', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ polls: [] });
      }),
    );
    render(<CollabPolls {...defaultProps} />);
    // The spinner is a div with animation style
    expect(
      document.querySelector('[style*="animation"]'),
    ).toBeInTheDocument();
  });

  it('FE-COMP-POLLS-003: renders poll question from API', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll()] }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Best destination?');
  });

  it('FE-COMP-POLLS-004: renders poll options', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll()] }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Paris');
    expect(screen.getByText('Rome')).toBeInTheDocument();
  });

  it('FE-COMP-POLLS-005: New Poll button is visible when user can edit', async () => {
    render(<CollabPolls {...defaultProps} />);
    // Wait for loading to finish
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);
    expect(
      screen.getByRole('button', { name: /new/i }),
    ).toBeInTheDocument();
  });

  it('FE-COMP-POLLS-006: clicking New Poll button opens the create modal', async () => {
    const user = userEvent.setup();
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);
    await user.click(screen.getByRole('button', { name: /new/i }));
    // Modal has a question placeholder input
    await screen.findByPlaceholderText(/what should we do/i);
  });

  it('FE-COMP-POLLS-007: create modal requires question and at least 2 options to enable submit', async () => {
    const user = userEvent.setup();
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);
    await user.click(screen.getByRole('button', { name: /new/i }));

    // Find submit button - it's the form submit with the create label
    const submitBtn = screen.getByRole('button', { name: /create|collab\.polls\.create/i });
    expect(submitBtn).toBeDisabled();

    // Fill in question
    const questionInput = screen.getByPlaceholderText(/what should we do/i);
    await user.type(questionInput, 'Where to go?');

    // Still disabled — no options filled
    expect(submitBtn).toBeDisabled();

    // Fill in 2 options
    const optionInputs = screen.getAllByPlaceholderText(/option/i);
    await user.type(optionInputs[0], 'Beach');
    await user.type(optionInputs[1], 'Mountain');

    expect(submitBtn).toBeEnabled();
  });

  it('FE-COMP-POLLS-008: creating a poll calls POST API and adds it to the list', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ poll: buildPoll({ id: 99, question: 'Where to eat?' }) }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);

    await user.click(screen.getByRole('button', { name: /new/i }));
    await user.type(screen.getByPlaceholderText(/what should we do/i), 'Where to eat?');
    const optionInputs = screen.getAllByPlaceholderText(/option/i);
    await user.type(optionInputs[0], 'Italian');
    await user.type(optionInputs[1], 'Japanese');

    await user.click(screen.getByRole('button', { name: /create|collab\.polls\.create/i }));
    await screen.findByText('Where to eat?');
  });

  it('FE-COMP-POLLS-009: voting on an option calls POST vote API', async () => {
    let voteCalled = false;
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll()] }),
      ),
      http.post('/api/trips/1/collab/polls/1/vote', () => {
        voteCalled = true;
        return HttpResponse.json({
          poll: buildPoll({
            options: [
              { id: 1, text: 'Paris', label: 'Paris', voters: [{ user_id: 1, username: 'testuser', avatar_url: null }] },
              { id: 2, text: 'Rome', label: 'Rome', voters: [] },
            ],
          }),
        });
      }),
    );
    const user = userEvent.setup();
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Paris');
    await user.click(screen.getByText('Paris'));
    await waitFor(() => expect(voteCalled).toBe(true));
  });

  it('FE-COMP-POLLS-010: closed poll shows "Closed" badge', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll({ is_closed: true })] }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/closed/i);
  });

  it('FE-COMP-POLLS-011: closed poll options are disabled (cannot vote)', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll({ is_closed: true })] }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Paris');
    const parisBtn = screen.getByText('Paris').closest('button');
    expect(parisBtn).toBeDisabled();
  });

  it('FE-COMP-POLLS-012: delete button calls DELETE API and removes poll', async () => {
    let deleteCalled = false;
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll({ id: 5 })] }),
      ),
      http.delete('/api/trips/1/collab/polls/5', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Best destination?');

    // Delete button has a title with "delete"
    const deleteBtn = screen.getByTitle(/delete/i);
    await user.click(deleteBtn);

    await waitFor(() => expect(deleteCalled).toBe(true));
    await waitFor(() =>
      expect(screen.queryByText('Best destination?')).not.toBeInTheDocument(),
    );
  });

  it('FE-COMP-POLLS-013: WebSocket collab:poll:created event adds poll', async () => {
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);

    // Get the WS listener that was registered
    const listener = (addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({ type: 'collab:poll:created', poll: buildPoll({ id: 77, question: 'Live poll?' }) });

    await screen.findByText('Live poll?');
  });

  it('FE-COMP-POLLS-014: WebSocket collab:poll:deleted event removes poll', async () => {
    server.use(
      http.get('/api/trips/1/collab/polls', () =>
        HttpResponse.json({ polls: [buildPoll({ id: 3 })] }),
      ),
    );
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText('Best destination?');

    const listener = (addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];
    listener({ type: 'collab:poll:deleted', pollId: 3 });

    await waitFor(() =>
      expect(screen.queryByText('Best destination?')).not.toBeInTheDocument(),
    );
  });

  it('FE-COMP-POLLS-015: adding a third option in create modal', async () => {
    const user = userEvent.setup();
    render(<CollabPolls {...defaultProps} />);
    await screen.findByText(/no polls yet|collab\.polls\.empty/i);
    await user.click(screen.getByRole('button', { name: /new/i }));

    // Initially 2 option inputs
    let optionInputs = screen.getAllByPlaceholderText(/option/i);
    expect(optionInputs).toHaveLength(2);

    // Click "Add option"
    await user.click(screen.getByText(/add option/i));

    optionInputs = screen.getAllByPlaceholderText(/option/i);
    expect(optionInputs).toHaveLength(3);
  });
});
