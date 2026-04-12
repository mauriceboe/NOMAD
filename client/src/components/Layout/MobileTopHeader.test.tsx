// FE-COMP-MOBILETOPHEADER-001 to FE-COMP-MOBILETOPHEADER-004

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../tests/helpers/render';
import MobileTopHeader from './MobileTopHeader';

describe('MobileTopHeader', () => {
  it('FE-COMP-MOBILETOPHEADER-001: renders title as h1', () => {
    render(<MobileTopHeader title="Journeys" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBe('Journeys');
  });

  it('FE-COMP-MOBILETOPHEADER-002: renders subtitle when provided', () => {
    render(<MobileTopHeader title="Journeys" subtitle="3 trips" />);
    expect(screen.getByText('3 trips')).toBeInTheDocument();
  });

  it('FE-COMP-MOBILETOPHEADER-003: does not render subtitle when omitted', () => {
    const { container } = render(<MobileTopHeader title="Journeys" />);
    const subtitleEl = container.querySelector('.text-xs.text-zinc-500');
    expect(subtitleEl).not.toBeInTheDocument();
  });

  it('FE-COMP-MOBILETOPHEADER-004: renders action children when provided', () => {
    render(
      <MobileTopHeader title="Trips" actions={<button>Add</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
