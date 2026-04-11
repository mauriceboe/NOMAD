import { render, screen, act } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from './Toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function addToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) {
    act(() => {
      window.__addToast!(message, type, duration);
    });
  }

  it('FE-COMP-TOAST-001: renders empty container initially', () => {
    const { container } = render(<ToastContainer />);
    // No toast items — only the outer container div
    expect(container.querySelectorAll('.nomad-toast').length).toBe(0);
  });

  it('FE-COMP-TOAST-002: success toast renders with message', () => {
    render(<ToastContainer />);
    addToast('File saved successfully', 'success');
    expect(screen.getByText('File saved successfully')).toBeTruthy();
  });

  it('FE-COMP-TOAST-003: error toast renders with message', () => {
    render(<ToastContainer />);
    addToast('Something went wrong', 'error');
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('FE-COMP-TOAST-004: warning toast renders with message', () => {
    render(<ToastContainer />);
    addToast('Low disk space', 'warning');
    expect(screen.getByText('Low disk space')).toBeTruthy();
  });

  it('FE-COMP-TOAST-005: info toast renders with message', () => {
    render(<ToastContainer />);
    addToast('Update available', 'info');
    expect(screen.getByText('Update available')).toBeTruthy();
  });

  it('FE-COMP-TOAST-006: toast auto-dismisses after duration', () => {
    render(<ToastContainer />);
    addToast('Temporary message', 'info', 2000);
    expect(screen.getByText('Temporary message')).toBeTruthy();

    // After duration + 400ms animation delay, toast is removed
    act(() => {
      vi.advanceTimersByTime(2000 + 400 + 10);
    });

    expect(screen.queryByText('Temporary message')).toBeNull();
  });

  it('FE-COMP-TOAST-007: clicking close button dismisses the toast', () => {
    const { container } = render(<ToastContainer />);
    act(() => {
      window.__addToast!('Close me', 'success', 0); // duration 0 = no auto-dismiss
    });

    expect(screen.getByText('Close me')).toBeTruthy();

    const closeBtn = container.querySelector('.nomad-toast button') as HTMLElement;
    act(() => {
      closeBtn.click();
    });

    // removeToast sets removing: true then schedules removal after 400ms
    act(() => {
      vi.advanceTimersByTime(401);
    });

    expect(screen.queryByText('Close me')).toBeNull();
  });

  it('FE-COMP-TOAST-008: multiple toasts display simultaneously', () => {
    render(<ToastContainer />);
    addToast('First toast', 'success', 0);
    addToast('Second toast', 'error', 0);
    addToast('Third toast', 'info', 0);

    expect(screen.getByText('First toast')).toBeTruthy();
    expect(screen.getByText('Second toast')).toBeTruthy();
    expect(screen.getByText('Third toast')).toBeTruthy();
  });
});
