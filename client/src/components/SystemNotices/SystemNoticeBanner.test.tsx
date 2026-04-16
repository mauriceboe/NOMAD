import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { render, screen, fireEvent } from '../../../tests/helpers/render';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useSystemNoticeStore } from '../../store/systemNoticeStore';
import { BannerRenderer } from './SystemNoticeBanner';
import type { SystemNoticeDTO } from '../../store/systemNoticeStore';

function makeBanner(overrides: Partial<SystemNoticeDTO> = {}): SystemNoticeDTO {
  return {
    id: 'banner-1',
    display: 'banner',
    severity: 'info',
    titleKey: 'Maintenance notice',
    bodyKey: 'System will be down briefly.',
    dismissible: true,
    ...overrides,
  };
}

describe('BannerRenderer', () => {
  beforeEach(() => {
    server.use(
      http.post('/api/system-notices/:id/dismiss', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
    useSystemNoticeStore.setState({ notices: [], loaded: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty('--banner-stack-h');
  });

  it('FE-SN-BANNER-001: renders banner with correct title and body', async () => {
    const notice = makeBanner();
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    expect(screen.getByText('Maintenance notice')).toBeTruthy();
    expect(screen.getByText('System will be down briefly.')).toBeTruthy();
  });

  it('FE-SN-BANNER-002: dismiss button calls store.dismiss(id)', async () => {
    const notice = makeBanner();
    useSystemNoticeStore.setState({ notices: [notice], loaded: true });

    const dismissSpy = vi.spyOn(useSystemNoticeStore.getState(), 'dismiss');
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    const dismissBtn = screen.getByLabelText(/Dismiss/);
    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    expect(dismissSpy).toHaveBeenCalledWith('banner-1');
  });

  it('FE-SN-BANNER-003: two banners stack correctly', async () => {
    const n1 = makeBanner({ id: 'banner-1', titleKey: 'First notice' });
    const n2 = makeBanner({ id: 'banner-2', titleKey: 'Second notice' });
    await act(async () => {
      render(<BannerRenderer notices={[n1, n2]} />);
    });

    expect(screen.getByText('First notice')).toBeTruthy();
    expect(screen.getByText('Second notice')).toBeTruthy();
  });

  it('FE-SN-BANNER-004: third banner is not rendered (only top 2 shown)', async () => {
    // Server returns notices highest-priority first; BannerRenderer takes slice(0,2)
    const n1 = makeBanner({ id: 'banner-1', titleKey: 'Highest notice' });
    const n2 = makeBanner({ id: 'banner-2', titleKey: 'Second notice' });
    const n3 = makeBanner({ id: 'banner-3', titleKey: 'Lowest notice' });
    await act(async () => {
      render(<BannerRenderer notices={[n1, n2, n3]} />);
    });

    expect(screen.getByText('Highest notice')).toBeTruthy();
    expect(screen.getByText('Second notice')).toBeTruthy();
    expect(screen.queryByText('Lowest notice')).toBeNull();
  });

  it('FE-SN-BANNER-005: critical banner has aria-live="assertive"', async () => {
    const notice = makeBanner({ severity: 'critical', id: 'crit-1' });
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    const alertEl = screen.getByRole('alert');
    expect(alertEl.getAttribute('aria-live')).toBe('assertive');
  });

  it('FE-SN-BANNER-006: info banner has aria-live="polite"', async () => {
    const notice = makeBanner({ severity: 'info' });
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });

  it('FE-SN-BANNER-007: warn banner has aria-live="polite"', async () => {
    const notice = makeBanner({ severity: 'warn', id: 'warn-1' });
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });

  it('FE-SN-BANNER-008: renders nothing when notices array is empty', () => {
    const { container } = render(<BannerRenderer notices={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('FE-SN-BANNER-009: non-dismissible banner hides dismiss button', async () => {
    const notice = makeBanner({ dismissible: false });
    await act(async () => {
      render(<BannerRenderer notices={[notice]} />);
    });

    expect(screen.getByText('Maintenance notice')).toBeTruthy();
    expect(screen.queryByLabelText(/Dismiss/)).toBeNull();
  });
});
