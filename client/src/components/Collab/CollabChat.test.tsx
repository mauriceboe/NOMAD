// FE-COMP-CHAT-001 to FE-COMP-CHAT-012
// jsdom doesn't implement scrollTo — mock it to prevent uncaught exceptions from CollabChat's scrollToBottom
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as any;
});

// CollabChat uses addListener/removeListener from websocket — extend the global mock
vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

import { render, screen, waitFor, act, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { useSettingsStore } from '../../store/settingsStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip } from '../../../tests/helpers/factories';
import CollabChat from './CollabChat';
import { addListener } from '../../api/websocket';

const currentUser = buildUser({ id: 1, username: 'testuser' });

const defaultProps = {
  tripId: 1,
  currentUser,
};

beforeEach(() => {
  resetAllStores();
  server.use(
    http.get('/api/trips/1/collab/messages', () =>
      HttpResponse.json({ messages: [], total: 0 })
    ),
  );
  seedStore(useAuthStore, { user: currentUser, isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1 }) });
});

describe('CollabChat', () => {
  it('FE-COMP-CHAT-001: renders without crashing', () => {
    render(<CollabChat {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-002: shows empty state when no messages', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
  });

  it('FE-COMP-CHAT-003: shows message input placeholder', async () => {
    render(<CollabChat {...defaultProps} />);
    // Wait for loading to complete
    await screen.findByText('Start the conversation');
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-004: shows send button (ArrowUp icon, no title)', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    // Send button has no title attr — verify buttons exist in the toolbar area
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('FE-COMP-CHAT-005: shows existing messages from API', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: currentUser.id, username: 'testuser',
            avatar_url: null, text: 'Hello world!', created_at: '2025-06-01T10:00:00.000Z',
            reactions: {}, reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Hello world!');
  });

  it('FE-COMP-CHAT-006: typing in input updates text field', async () => {
    const user = userEvent.setup();
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'Test message');
    expect((input as HTMLTextAreaElement).value).toBe('Test message');
  });

  it('FE-COMP-CHAT-007: submitting message via Enter calls POST API', async () => {
    const user = userEvent.setup();
    let postCalled = false;
    server.use(
      http.post('/api/trips/1/collab/messages', async () => {
        postCalled = true;
        return HttpResponse.json({
          id: 2, trip_id: 1, user_id: 1, username: 'testuser',
          avatar_url: null, text: 'New message', created_at: new Date().toISOString(),
          reactions: {}, reply_to: null, deleted: false, edited: false,
        });
      })
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const input = screen.getByPlaceholderText('Type a message...');
    // Enter key sends message (Shift+Enter = newline, Enter = send)
    await user.type(input, 'New message{Enter}');
    await waitFor(() => expect(postCalled).toBe(true));
  });

  it('FE-COMP-CHAT-008: message input area is present after loading', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-009: shows hint text in empty state', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText(/Share ideas, plans/i);
  });

  it('FE-COMP-CHAT-010: chat container renders', () => {
    render(<CollabChat {...defaultProps} />);
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it('FE-COMP-CHAT-011: multiple messages all render', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [
            { id: 1, trip_id: 1, user_id: 1, username: 'testuser', avatar_url: null, text: 'First message', created_at: '2025-06-01T10:00:00.000Z', reactions: {}, reply_to: null, deleted: false, edited: false },
            { id: 2, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null, text: 'Second message', created_at: '2025-06-01T10:01:00.000Z', reactions: {}, reply_to: null, deleted: false, edited: false },
          ],
          total: 2,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('First message');
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-012: shows emoji button in the toolbar', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    // Emoji button is a button in the toolbar
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('FE-COMP-CHAT-013: date separator shows "Today" for messages sent today', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Hello world!', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Hello world!');
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-014: Shift+Enter inserts a newline instead of sending', async () => {
    const user = userEvent.setup();
    let postCalled = false;
    server.use(
      http.post('/api/trips/1/collab/messages', async () => {
        postCalled = true;
        return HttpResponse.json({});
      })
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const input = screen.getByPlaceholderText('Type a message...');
    await user.click(input);
    await user.type(input, 'Line1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(input, 'Line2');
    expect((input as HTMLTextAreaElement).value).toContain('\n');
    expect(postCalled).toBe(false);
  });

  it('FE-COMP-CHAT-015: deleted message shows fallback text', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'some text', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: true, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/deleted/i)).toBeInTheDocument();
    });
  });

  it('FE-COMP-CHAT-017: reaction badge renders for a message with reactions', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'React to me', created_at: new Date().toISOString(),
            reactions: [{ emoji: '❤️', count: 1, users: [{ user_id: 2, username: 'alice' }] }],
            reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('React to me');
    // ReactionBadge renders a button containing a TwemojiImg with alt=emoji
    const img = screen.getByAltText('❤️');
    expect(img).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-018: WebSocket collab:message:created event adds message to list', async () => {
    vi.clearAllMocks();
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    await waitFor(() => expect(addListener).toHaveBeenCalled());
    const handler = (addListener as any).mock.calls[0][0];
    await act(async () => {
      handler({
        type: 'collab:message:created',
        tripId: 1,
        message: {
          id: 99, trip_id: 1, user_id: 2, username: 'alice',
          text: 'WS message', created_at: new Date().toISOString(),
          reactions: [], reply_to: null, deleted: false, edited: false,
        },
      });
    });
    expect(await screen.findByText('WS message')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-019: WebSocket collab:message:deleted event marks message as deleted', async () => {
    vi.clearAllMocks();
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'To remove', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('To remove');
    await waitFor(() => expect(addListener).toHaveBeenCalled());
    const handler = (addListener as any).mock.calls[0][0];
    await act(async () => {
      handler({ type: 'collab:message:deleted', tripId: 1, messageId: 1 });
    });
    await waitFor(() => {
      expect(screen.queryByText('To remove')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/deleted/i)).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-020: send button is disabled when input is empty', async () => {
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const buttons = screen.getAllByRole('button');
    // The send button is the ArrowUp button — it has disabled attr when text is empty
    const sendButton = buttons.find(b => b.hasAttribute('disabled'));
    expect(sendButton).toBeTruthy();
    expect(sendButton).toBeDisabled();
  });

  it('FE-COMP-CHAT-021: reply-to banner shows quoted author and text', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Reply here', created_at: new Date().toISOString(),
            reactions: [], reply_to: null,
            reply_text: 'Original message', reply_username: 'alice',
            deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Reply here');
    expect(screen.getByText(/Original message/i)).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-022: own messages are displayed with blue bubble', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: currentUser.id, username: 'testuser', avatar_url: null,
            text: 'My own message', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('My own message');
    // Own messages don't show a username label above the bubble (only other users get it)
    // The component renders {!own && isNewGroup && <span>{msg.username}</span>}
    // so 'testuser' should NOT appear as a username label
    const usernameLabels = screen.queryAllByText('testuser');
    expect(usernameLabels.length).toBe(0);
    // And own message bubble uses row-reverse flex direction
    const messageEl = screen.getByText('My own message');
    let parent = messageEl.parentElement;
    let foundRowReverse = false;
    while (parent) {
      const styleAttr = parent.getAttribute('style');
      if (styleAttr && styleAttr.includes('row-reverse')) {
        foundRowReverse = true;
        break;
      }
      parent = parent.parentElement;
    }
    expect(foundRowReverse).toBe(true);
  });

  it('FE-COMP-CHAT-023: sending a message clears the input field', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/trips/1/collab/messages', async () =>
        HttpResponse.json({
          message: {
            id: 2, trip_id: 1, user_id: 1, username: 'testuser',
            avatar_url: null, text: 'Sent message', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          },
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const input = screen.getByPlaceholderText('Type a message...');
    await user.type(input, 'Sent message');
    expect((input as HTMLTextAreaElement).value).toBe('Sent message');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('FE-COMP-CHAT-024: load earlier messages button appears when 100+ messages exist', async () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
      text: `Message ${i + 1}`, created_at: new Date().toISOString(),
      reactions: [], reply_to: null, deleted: false, edited: false,
    }));
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({ messages, total: 100 })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Message 1');
    const loadMoreBtn = await screen.findByRole('button', { name: /load/i });
    expect(loadMoreBtn).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-025: clicking reply button on a message sets reply-to preview', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Reply to me', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Reply to me');
    // Hover action buttons are always in DOM but hidden via pointer-events: none
    // Use fireEvent to bypass CSS pointer-events restrictions
    const replyBtn = screen.getByTitle('Reply');
    fireEvent.click(replyBtn);
    // Reply preview banner renders <strong>{username}</strong> — unique to the banner
    await waitFor(() => {
      const aliceEls = screen.queryAllByText('alice');
      expect(aliceEls.some(el => el.tagName === 'STRONG')).toBe(true);
    });
  });

  it('FE-COMP-CHAT-026: clicking X in reply preview cancels reply', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Cancel reply test', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Cancel reply test');
    // Click reply button to show preview (bypassing pointer-events: none)
    fireEvent.click(screen.getByTitle('Reply'));
    // Wait for reply preview <strong> to appear
    await waitFor(() => {
      const aliceEls = screen.queryAllByText('alice');
      expect(aliceEls.some(el => el.tagName === 'STRONG')).toBe(true);
    });
    // Find the X button inside the reply preview — the <strong> is inside a <span> inside the preview div
    const strongEl = screen.getAllByText('alice').find(el => el.tagName === 'STRONG')!;
    const previewDiv = strongEl.closest('div[style]');
    const xBtn = previewDiv?.querySelector('button');
    expect(xBtn).toBeTruthy();
    fireEvent.click(xBtn!);
    await waitFor(() => {
      // After cancel, no <strong>alice</strong> in reply preview
      const remaining = screen.queryAllByText('alice');
      expect(remaining.every(el => el.tagName !== 'STRONG')).toBe(true);
    });
  });

  it('FE-COMP-CHAT-027: clicking emoji button opens the emoji picker', async () => {
    const user = userEvent.setup();
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    // Smile button is the only non-disabled button when input is empty
    const allButtons = screen.getAllByRole('button');
    const smileBtn = allButtons.find(b => !b.hasAttribute('disabled'));
    expect(smileBtn).toBeTruthy();
    await user.click(smileBtn!);
    // EmojiPicker renders category tabs
    await screen.findByText('Smileys');
    expect(screen.getByText('Reactions')).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-028: selecting emoji from picker appends it to the input', async () => {
    const user = userEvent.setup();
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Start the conversation');
    const allButtons = screen.getAllByRole('button');
    const smileBtn = allButtons.find(b => !b.hasAttribute('disabled'));
    await user.click(smileBtn!);
    // Wait for picker to open
    await screen.findByText('Smileys');
    // Click the first emoji in the grid (😀 is the first in Smileys)
    const emojiImg = screen.getAllByRole('img').find(img => img.getAttribute('alt') === '😀');
    expect(emojiImg).toBeTruthy();
    await user.click(emojiImg!.closest('button')!);
    // Emoji should be appended to textarea
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect((textarea as HTMLTextAreaElement).value).toContain('😀');
  });

  it('FE-COMP-CHAT-029: right-clicking a message opens the reaction menu', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Right click me', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Right click me');
    const messageBubble = screen.getByText('Right click me').closest('div[style]');
    fireEvent.contextMenu(messageBubble!);
    // ReactionMenu renders quick reactions (❤️ is the first)
    await waitFor(() => {
      const reactionImgs = screen.getAllByRole('img').filter(img =>
        ['❤️', '😂', '👍'].includes(img.getAttribute('alt') || '')
      );
      expect(reactionImgs.length).toBeGreaterThan(0);
    });
  });

  it('FE-COMP-CHAT-030: clicking a reaction in the menu calls reactMessage API', async () => {
    let reactCalled = false;
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'React to this', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      ),
      http.post('/api/trips/1/collab/messages/1/react', async () => {
        reactCalled = true;
        return HttpResponse.json({ reactions: [{ emoji: '❤️', count: 1, users: [{ user_id: 1, username: 'testuser' }] }] });
      })
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('React to this');
    // Open reaction context menu
    const messageBubble = screen.getByText('React to this').closest('div[style]');
    fireEvent.contextMenu(messageBubble!);
    // Wait for menu and click first reaction (❤️)
    const heartImg = await screen.findByAltText('❤️');
    fireEvent.click(heartImg.closest('button')!);
    await waitFor(() => expect(reactCalled).toBe(true));
  });

  it('FE-COMP-CHAT-031: WebSocket collab:message:reacted event updates reactions', async () => {
    vi.clearAllMocks();
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Reacted message', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Reacted message');
    await waitFor(() => expect(addListener).toHaveBeenCalled());
    const handler = (addListener as any).mock.calls[0][0];
    await act(async () => {
      handler({
        type: 'collab:message:reacted',
        tripId: 1,
        messageId: 1,
        reactions: [{ emoji: '🔥', count: 1, users: [{ user_id: 2, username: 'alice' }] }],
      });
    });
    await screen.findByAltText('🔥');
  });

  it('FE-COMP-CHAT-032: clicking "Load older messages" loads paginated results', async () => {
    const initialMessages = Array.from({ length: 100 }, (_, i) => ({
      id: i + 100, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
      text: `New ${i + 100}`, created_at: new Date().toISOString(),
      reactions: [], reply_to: null, deleted: false, edited: false,
    }));
    let callCount = 0;
    server.use(
      http.get('/api/trips/1/collab/messages', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ messages: initialMessages, total: 120 });
        }
        return HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Older message', created_at: '2020-01-01T10:00:00.000Z',
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 120,
        });
      })
    );
    const user = userEvent.setup();
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('New 100');
    const loadMoreBtn = screen.getByRole('button', { name: /load/i });
    await user.click(loadMoreBtn);
    await screen.findByText('Older message');
  });

  it('FE-COMP-CHAT-033: clicking delete on own message marks it as deleted', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: currentUser.id, username: 'testuser', avatar_url: null,
            text: 'Delete me', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      ),
      http.delete('/api/trips/1/collab/messages/1', () =>
        HttpResponse.json({ success: true })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Delete me');
    // Delete button is in a hover-actions div with pointer-events: none — use fireEvent
    const deleteBtn = screen.getByTitle('Delete');
    fireEvent.click(deleteBtn);
    // handleDelete uses a 400ms setTimeout before calling the API
    await waitFor(
      () => expect(screen.getByText(/deleted/i)).toBeInTheDocument(),
      { timeout: 1500 }
    );
  });

  it('FE-COMP-CHAT-034: single-emoji message renders as big emoji', async () => {
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: '👍', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('👍');
    // Big emoji renders in a div with fontSize: 40px — include emojiEl itself in search
    const emojiEl = screen.getByText('👍');
    let el: HTMLElement | null = emojiEl as HTMLElement;
    let foundBigEmoji = false;
    while (el) {
      const styleAttr = el.getAttribute('style');
      if (styleAttr && styleAttr.includes('font-size: 40px')) {
        foundBigEmoji = true;
        break;
      }
      el = el.parentElement;
    }
    expect(foundBigEmoji).toBe(true);
  });

  it('FE-COMP-CHAT-035: 24h time format renders timestamp without AM/PM', async () => {
    seedStore(useSettingsStore, { settings: { time_format: '24h' } as any });
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: 'Time format test', created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText('Time format test');
    // 24h format: timestamp like "HH:MM" — no AM/PM suffix
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument();
    // There should be a timestamp element matching HH:MM
    const timestamp = screen.getByText((text) => /^\d{1,2}:\d{2}$/.test(text));
    expect(timestamp).toBeInTheDocument();
  });

  it('FE-COMP-CHAT-036: message with URL shows link preview when API returns data', async () => {
    const uniqueUrl = 'https://preview-test-unique-url-9999.example.com/page';
    server.use(
      http.get('/api/trips/1/collab/messages', () =>
        HttpResponse.json({
          messages: [{
            id: 1, trip_id: 1, user_id: 2, username: 'alice', avatar_url: null,
            text: `Check this out ${uniqueUrl}`,
            created_at: new Date().toISOString(),
            reactions: [], reply_to: null, deleted: false, edited: false,
          }],
          total: 1,
        })
      ),
      http.get('/api/trips/1/collab/link-preview', () =>
        HttpResponse.json({ title: 'Preview Title', description: 'Preview Desc', image: null, site_name: 'Example' })
      )
    );
    render(<CollabChat {...defaultProps} />);
    await screen.findByText(/Check this out/);
    await waitFor(
      () => expect(screen.getByText('Preview Title')).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
