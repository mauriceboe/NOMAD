import { render, screen, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onConfirm.mockClear();
  });

  it('FE-COMP-CONFIRM-001: does not render when isOpen is false', () => {
    render(
      <ConfirmDialog isOpen={false} onClose={onClose} onConfirm={onConfirm} message="Are you sure?" />
    );
    expect(screen.queryByText('Are you sure?')).toBeNull();
  });

  it('FE-COMP-CONFIRM-002: renders with default title "Confirm" and message', () => {
    render(
      <ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="Are you sure?" />
    );
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('FE-COMP-CONFIRM-003: renders custom title and message', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Remove item"
        message="This cannot be undone."
      />
    );
    expect(screen.getByText('Remove item')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });

  it('FE-COMP-CONFIRM-004: Cancel button calls onClose', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('FE-COMP-CONFIRM-005: Confirm button calls onConfirm and onClose', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FE-COMP-CONFIRM-006: custom button labels render correctly', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        confirmLabel="Yes, remove"
        cancelLabel="Go back"
      />
    );
    expect(screen.getByRole('button', { name: 'Yes, remove' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });

  it('FE-COMP-CONFIRM-007: Escape key calls onClose', () => {
    render(<ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FE-COMP-CONFIRM-008: clicking backdrop calls onClose', async () => {
    const user = userEvent.setup();
    render(<ConfirmDialog isOpen={true} onClose={onClose} onConfirm={onConfirm} message="msg" />);
    // The outermost fixed div is the backdrop — click outside the card
    const backdrop = document.querySelector('.fixed') as HTMLElement;
    // fireEvent click on the backdrop element directly
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
