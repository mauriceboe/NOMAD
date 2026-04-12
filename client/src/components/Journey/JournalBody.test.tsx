// FE-COMP-JOURNALBODY-001 to FE-COMP-JOURNALBODY-005

import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../tests/helpers/render';
import JournalBody from './JournalBody';

describe('JournalBody', () => {
  it('FE-COMP-JOURNALBODY-001: renders plain text content', () => {
    render(<JournalBody text="Hello traveller" />);
    expect(screen.getByText('Hello traveller')).toBeInTheDocument();
  });

  it('FE-COMP-JOURNALBODY-002: renders bold markdown as <strong>', () => {
    const { container } = render(<JournalBody text="This is **bold** text" />);
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong!.textContent).toBe('bold');
  });

  it('FE-COMP-JOURNALBODY-003: renders links with target _blank', () => {
    render(<JournalBody text="[Visit](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'Visit' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('FE-COMP-JOURNALBODY-004: renders headings with proper elements', () => {
    const { container } = render(<JournalBody text="## Section Title" />);
    const h2 = container.querySelector('h2');
    expect(h2).toBeInTheDocument();
    expect(h2!.textContent).toBe('Section Title');
  });

  it('FE-COMP-JOURNALBODY-005: handles empty text without crashing', () => {
    const { container } = render(<JournalBody text="" />);
    expect(container.querySelector('.journal-body')).toBeInTheDocument();
  });
});
