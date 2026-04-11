import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent } from '@testing-library/react';
import { render, screen } from '../../../tests/helpers/render';
import DemoBanner from './DemoBanner';

describe('DemoBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // FE-COMP-DEMOBANNER-001
  it('renders without crashing', () => {
    render(<DemoBanner />);
    expect(document.body).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-002
  it('overlay is visible on initial render with dismiss button', () => {
    render(<DemoBanner />);
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-003
  it('shows English welcome title by default', () => {
    render(<DemoBanner />);
    expect(screen.getByText(/Welcome to/i)).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-004
  it('clicking "Got it" dismisses the banner', async () => {
    const user = userEvent.setup();
    render(<DemoBanner />);
    const button = screen.getByText('Got it');
    await user.click(button);
    expect(screen.queryByText('Got it')).not.toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-005
  it('clicking the overlay backdrop dismisses the banner', () => {
    const { container } = render(<DemoBanner />);
    // The outermost fixed div is the overlay backdrop
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(screen.queryByText('Got it')).not.toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-006
  it('clicking the inner card does NOT dismiss', async () => {
    const user = userEvent.setup();
    render(<DemoBanner />);
    // The inner card is the direct parent of the "Got it" button's container
    const card = screen.getByText('Got it').closest('div[style*="background: white"]')!;
    await user.click(card);
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-007
  it('shows reset timer', () => {
    render(<DemoBanner />);
    expect(screen.getByText(/Next reset in/i)).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-008
  it('shows upload-disabled notice', () => {
    render(<DemoBanner />);
    expect(screen.getByText(/File uploads.*disabled in demo/i)).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-009
  it('shows "What is TREK?" section', () => {
    render(<DemoBanner />);
    expect(screen.getByText('What is TREK?')).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-010
  it('shows addon cards', () => {
    render(<DemoBanner />);
    expect(screen.getByText('Vacay')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-011
  it('shows full version features section', () => {
    render(<DemoBanner />);
    expect(screen.getByText(/Additionally in the full version/i)).toBeInTheDocument();
  });

  // FE-COMP-DEMOBANNER-012
  it('self-host link points to GitHub', () => {
    render(<DemoBanner />);
    const link = screen.getByText('self-host it').closest('a')!;
    expect(link).toHaveAttribute('href', 'https://github.com/mauriceboe/TREK');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // Timer update test
  it('updates countdown timer after interval tick', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    // Set time to XX:30 so minutesLeft = 59 - 30 = 29
    vi.setSystemTime(new Date(2026, 3, 7, 12, 30, 0));
    render(<DemoBanner />);
    expect(screen.getByText(/29 minutes/)).toBeInTheDocument();

    // Advance to XX:31 and tick the interval; wrap in act so React flushes state update
    await act(async () => {
      vi.setSystemTime(new Date(2026, 3, 7, 12, 31, 0));
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText(/28 minutes/)).toBeInTheDocument();
  });
});
