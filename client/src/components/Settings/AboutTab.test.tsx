import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../tests/helpers/render';
import { resetAllStores } from '../../../tests/helpers/store';
import AboutTab from './AboutTab';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('AboutTab', () => {
  it('FE-COMP-ABOUT-001: renders without crashing', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-002: displays the version badge', () => {
    render(<AboutTab appVersion="2.9.10" />);
    expect(screen.getByText('v2.9.10')).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-003: displays Ko-fi link with correct href', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Ko-fi').closest('a');
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/mauriceboe');
  });

  it('FE-COMP-ABOUT-004: displays Buy Me a Coffee link with correct href', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Buy Me a Coffee').closest('a');
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/mauriceboe');
  });

  it('FE-COMP-ABOUT-005: displays Discord link with correct href', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = screen.getByText('Discord').closest('a');
    expect(link).toHaveAttribute('href', 'https://discord.gg/nSdKaXgN');
  });

  it('FE-COMP-ABOUT-006: displays bug report link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = document.querySelector('a[href*="issues/new"]');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/mauriceboe/TREK/issues/new?template=bug_report.yml',
    );
  });

  it('FE-COMP-ABOUT-007: displays feature request link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = document.querySelector('a[href*="discussions/new"]');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('FE-COMP-ABOUT-008: displays wiki link', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const link = document.querySelector('a[href*="wiki"]');
    expect(link).toBeInTheDocument();
  });

  it('FE-COMP-ABOUT-009: all external links have rel="noopener noreferrer"', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const links = document.querySelectorAll('a');
    expect(links).toHaveLength(6);
    links.forEach((link) => {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('FE-COMP-ABOUT-010: all external links open in a new tab', () => {
    render(<AboutTab appVersion="2.9.10" />);
    const links = document.querySelectorAll('a');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('FE-COMP-ABOUT-011: version prop change is reflected', () => {
    render(<AboutTab appVersion="1.0.0" />);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.queryByText('v2.9.10')).toBeNull();
  });

  it('FE-COMP-ABOUT-012: Ko-fi link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Ko-fi').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(255, 94, 91)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-013: Buy Me a Coffee link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Buy Me a Coffee').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(255, 221, 0)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-014: Discord link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = screen.getByText('Discord').closest('a') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(88, 101, 242)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-015: Bug report link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = document.querySelector('a[href*="issues/new"]') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(239, 68, 68)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-016: Feature request link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = document.querySelector('a[href*="discussions/new"]') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(245, 158, 11)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });

  it('FE-COMP-ABOUT-017: Wiki link hover changes border and box-shadow styles', () => {
    render(<AboutTab appVersion="1.0.0" />);
    const link = document.querySelector('a[href*="wiki"]') as HTMLAnchorElement;
    fireEvent.mouseEnter(link);
    expect(link.style.borderColor).toBe('rgb(99, 102, 241)');
    expect(link.style.boxShadow).not.toBe('');
    fireEvent.mouseLeave(link);
    expect(link.style.borderColor).toBe('var(--border-primary)');
    expect(link.style.boxShadow).toBe('none');
  });
});
