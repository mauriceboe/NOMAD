import { render, screen, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    document.body.style.overflow = '';
  });

  it('FE-COMP-MODAL-001: does not render when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={onClose}><p>content</p></Modal>);
    expect(screen.queryByText('content')).toBeNull();
  });

  it('FE-COMP-MODAL-002: renders overlay when isOpen is true', () => {
    render(<Modal isOpen={true} onClose={onClose}><p>content</p></Modal>);
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('FE-COMP-MODAL-003: renders the title prop', () => {
    render(<Modal isOpen={true} onClose={onClose} title="My Modal Title" />);
    expect(screen.getByText('My Modal Title')).toBeTruthy();
  });

  it('FE-COMP-MODAL-004: renders children content', () => {
    render(<Modal isOpen={true} onClose={onClose}><p>Hello World</p></Modal>);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('FE-COMP-MODAL-005: renders footer prop', () => {
    render(
      <Modal isOpen={true} onClose={onClose} footer={<button>Save</button>}>
        <p>body</p>
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('FE-COMP-MODAL-006: close button calls onClose', async () => {
    const user = userEvent.setup();
    render(<Modal isOpen={true} onClose={onClose} title="T" />);
    // The X button is the only button rendered by Modal itself
    const closeBtn = document.querySelector('button');
    await user.click(closeBtn!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FE-COMP-MODAL-007: Escape key calls onClose', () => {
    render(<Modal isOpen={true} onClose={onClose} title="T" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FE-COMP-MODAL-008: clicking the backdrop calls onClose', () => {
    render(<Modal isOpen={true} onClose={onClose}><p>inner</p></Modal>);
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
    // Simulate mousedown then click on the backdrop itself
    fireEvent.mouseDown(backdrop, { target: backdrop });
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('FE-COMP-MODAL-009: clicking inside modal content does NOT call onClose', async () => {
    const user = userEvent.setup();
    render(<Modal isOpen={true} onClose={onClose}><p>inner content</p></Modal>);
    await user.click(screen.getByText('inner content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('FE-COMP-MODAL-010: close button is hidden when hideCloseButton is true', () => {
    render(<Modal isOpen={true} onClose={onClose} title="T" hideCloseButton={true} />);
    // No button should be present in the modal header
    expect(document.querySelector('button')).toBeNull();
  });

  it('FE-COMP-MODAL-011: sets document.body overflow to hidden when open', () => {
    render(<Modal isOpen={true} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('hidden');
  });
});
