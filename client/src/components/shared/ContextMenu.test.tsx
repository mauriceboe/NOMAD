import { render, screen, fireEvent, act } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';
import { Trash2, Edit } from 'lucide-react';

const makeMenu = (x = 100, y = 200, overrides?: object[]) => ({
  x,
  y,
  items: overrides ?? [
    { label: 'Edit', icon: Edit, onClick: vi.fn() },
    { label: 'Delete', icon: Trash2, onClick: vi.fn(), danger: true },
  ],
});

describe('ContextMenu', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('FE-COMP-CTX-001: renders nothing when menu is null', () => {
    render(<ContextMenu menu={null} onClose={onClose} />);
    expect(document.body.querySelector('[style*="z-index: 999999"]')).toBeNull();
  });

  it('FE-COMP-CTX-002: renders menu items at the specified position', () => {
    render(<ContextMenu menu={makeMenu(150, 250)} onClose={onClose} />);
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();

    // Portal root div has position fixed at the given coords
    const portal = document.body.querySelector('[style*="position: fixed"]') as HTMLElement;
    expect(portal.style.left).toBe('150px');
    expect(portal.style.top).toBe('250px');
  });

  it('FE-COMP-CTX-003: clicking a menu item calls its onClick and onClose', async () => {
    const onClick = vi.fn();
    const menu = makeMenu(100, 200, [{ label: 'Copy', onClick }]);
    const user = userEvent.setup();
    render(<ContextMenu menu={menu} onClose={onClose} />);

    await user.click(screen.getByText('Copy'));
    expect(onClick).toHaveBeenCalledOnce();
    // onClose is called once by the button handler and once by the document click listener
    expect(onClose).toHaveBeenCalled();
  });

  it('FE-COMP-CTX-004: divider items render as a separator without text', () => {
    const menu = makeMenu(100, 200, [
      { label: 'Item A', onClick: vi.fn() },
      { divider: true },
      { label: 'Item B', onClick: vi.fn() },
    ]);
    render(<ContextMenu menu={menu} onClose={onClose} />);
    expect(screen.getByText('Item A')).toBeTruthy();
    expect(screen.getByText('Item B')).toBeTruthy();
    // Divider should not have any button text
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('FE-COMP-CTX-005: danger items have red color styling', () => {
    const menu = makeMenu(100, 200, [
      { label: 'Remove', onClick: vi.fn(), danger: true },
    ]);
    render(<ContextMenu menu={menu} onClose={onClose} />);
    const btn = screen.getByRole('button', { name: /remove/i });
    // Danger buttons use color #ef4444 inline style
    expect(btn.style.color).toBe('rgb(239, 68, 68)');
  });

  it('FE-COMP-CTX-006: clicking outside the menu closes it via document click listener', () => {
    render(<ContextMenu menu={makeMenu()} onClose={onClose} />);
    // Document click event triggers the close handler
    act(() => {
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
