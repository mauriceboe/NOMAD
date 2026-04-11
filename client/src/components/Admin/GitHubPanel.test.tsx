// FE-ADMIN-GH-001 to FE-ADMIN-GH-016
import { render, screen, waitFor, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { resetAllStores } from '../../../tests/helpers/store';
import GitHubPanel from './GitHubPanel';

function buildRelease(overrides = {}) {
  const id = Math.random();
  return {
    id,
    tag_name: 'v1.0.0',
    name: 'Initial Release',
    body: '## Changes\n- Fixed bug\n- **Bold improvement**\n- `code snippet`',
    published_at: '2025-01-15T12:00:00Z',
    created_at: '2025-01-15T12:00:00Z',
    prerelease: false,
    author: { login: 'mauriceboe' },
    ...overrides,
  };
}

const PAGE_1 = Array.from({ length: 10 }, (_, i) =>
  buildRelease({ id: i + 1, tag_name: `v1.${i}.0` }),
);
const PAGE_2 = Array.from({ length: 5 }, (_, i) =>
  buildRelease({ id: 100 + i, tag_name: `v0.${i}.0` }),
);

beforeEach(() => {
  resetAllStores();
  server.use(
    http.get('/api/admin/github-releases', () => HttpResponse.json([])),
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe('GitHubPanel', () => {
  it('FE-ADMIN-GH-001: support link cards always render', async () => {
    render(<GitHubPanel />);
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Ko-fi')).toBeInTheDocument();
    expect(screen.getByText('Buy Me a Coffee')).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
    expect(screen.getByText('Report a Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature Request')).toBeInTheDocument();
    expect(screen.getByText('Wiki')).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-002: all support links have correct href and target=_blank', async () => {
    render(<GitHubPanel />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const kofi = screen.getByText('Ko-fi').closest('a')!;
    expect(kofi).toHaveAttribute('href', 'https://ko-fi.com/mauriceboe');
    expect(kofi).toHaveAttribute('target', '_blank');
    expect(kofi).toHaveAttribute('rel', 'noopener noreferrer');

    const bmc = screen.getByText('Buy Me a Coffee').closest('a')!;
    expect(bmc).toHaveAttribute('href', 'https://buymeacoffee.com/mauriceboe');
    expect(bmc).toHaveAttribute('target', '_blank');
    expect(bmc).toHaveAttribute('rel', 'noopener noreferrer');

    const discord = screen.getByText('Discord').closest('a')!;
    expect(discord).toHaveAttribute('href', 'https://discord.gg/nSdKaXgN');
    expect(discord).toHaveAttribute('target', '_blank');
    expect(discord).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('FE-ADMIN-GH-003: loading spinner shown while fetching releases', () => {
    server.use(
      http.get('/api/admin/github-releases', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json([]);
      }),
    );
    render(<GitHubPanel />);
    // The Loader2 spinner is rendered while loading=true
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-004: error state shown on API failure', async () => {
    server.use(
      http.get('/api/admin/github-releases', () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    render(<GitHubPanel />);
    await screen.findByText('Failed to load releases');
    // Timeline should not be rendered
    expect(screen.queryByText('Release History')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-GH-005: releases render in timeline', async () => {
    const r1 = buildRelease({ id: 1, tag_name: 'v1.0.0', author: { login: 'mauriceboe' } });
    const r2 = buildRelease({ id: 2, tag_name: 'v1.1.0', author: { login: 'mauriceboe' } });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r1, r2])),
    );
    render(<GitHubPanel />);
    await screen.findByText('v1.0.0');
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
    // Author label
    const authorLabels = screen.getAllByText(/mauriceboe/);
    expect(authorLabels.length).toBeGreaterThan(0);
    // Some date should be visible (non-empty)
    const dateEls = document.querySelectorAll('[class*="text-"]');
    const dateTexts = Array.from(dateEls).map(el => el.textContent).filter(t => t && t.match(/\d{4}/));
    expect(dateTexts.length).toBeGreaterThan(0);
  });

  it('FE-ADMIN-GH-006: latest badge shown only on first release', async () => {
    const r1 = buildRelease({ id: 1, tag_name: 'v2.0.0' });
    const r2 = buildRelease({ id: 2, tag_name: 'v1.9.0' });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r1, r2])),
    );
    render(<GitHubPanel />);
    await screen.findByText('v2.0.0');
    const latestBadges = screen.getAllByText('Latest');
    expect(latestBadges).toHaveLength(1);
  });

  it('FE-ADMIN-GH-007: prerelease badge shown', async () => {
    const r = buildRelease({ id: 10, tag_name: 'v3.0.0-beta.1', prerelease: true });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    render(<GitHubPanel />);
    await screen.findByText('v3.0.0-beta.1');
    expect(screen.getByText('Pre-release')).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-008: expand/collapse release notes', async () => {
    const r = buildRelease({
      id: 20,
      tag_name: 'v1.5.0',
      body: '- Fixed bug\n- Another fix',
    });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.5.0');

    const showBtn = screen.getByText('Show details');
    expect(showBtn).toBeInTheDocument();

    // Body not visible yet
    expect(screen.queryByText('Fixed bug')).not.toBeInTheDocument();

    // Expand
    await user.click(showBtn);
    await screen.findByText('Fixed bug');
    expect(screen.getByText('Hide details')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Hide details'));
    await waitFor(() =>
      expect(screen.queryByText('Fixed bug')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Show details')).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-009: release body renders markdown: lists, bold, code', async () => {
    const r = buildRelease({
      id: 30,
      tag_name: 'v1.6.0',
      body: '- list item\n- **bold text**\n- `inline code`',
    });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.6.0');

    await user.click(screen.getByText('Show details'));
    await screen.findByText('list item');

    // list item is inside a <li>
    const listItem = screen.getByText('list item');
    expect(listItem.closest('li')).toBeInTheDocument();

    // Bold text rendered as <strong>
    const container = document.querySelector('.mt-2.p-3.rounded-lg')!;
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('strong')!.textContent).toBe('bold text');

    // Code rendered as <code>
    expect(container.querySelector('code')).toBeInTheDocument();
    expect(container.querySelector('code')!.textContent).toBe('inline code');
  });

  it('FE-ADMIN-GH-010: "Load more" button visible when full page returned', async () => {
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json(PAGE_1)),
    );
    render(<GitHubPanel />);
    await screen.findByText(`v1.0.0`);
    expect(screen.getByText('Load more')).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-011: "Load more" hidden when partial page returned', async () => {
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json(PAGE_2)),
    );
    render(<GitHubPanel />);
    await screen.findByText('v0.0.0');
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('FE-ADMIN-GH-013: release body renders plain paragraph text', async () => {
    const r = buildRelease({
      id: 40,
      tag_name: 'v1.7.0',
      body: 'This is a plain paragraph without any markdown syntax.',
    });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.7.0');
    await user.click(screen.getByText('Show details'));
    await screen.findByText('This is a plain paragraph without any markdown syntax.');
  });

  it('FE-ADMIN-GH-014: markdown link with safe href renders as anchor', async () => {
    const r = buildRelease({
      id: 41,
      tag_name: 'v1.8.0',
      body: '- [click here](https://example.com)',
    });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.8.0');
    await user.click(screen.getByText('Show details'));
    const link = await screen.findByText('click here');
    expect(link.closest('a') || link.tagName.toLowerCase() === 'a' ? link : null).not.toBeNull();
  });

  it('FE-ADMIN-GH-015: javascript: link is sanitized to #', async () => {
    const r = buildRelease({
      id: 42,
      tag_name: 'v1.9.0',
      body: '- [evil](javascript:alert(1))',
    });
    server.use(
      http.get('/api/admin/github-releases', () => HttpResponse.json([r])),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.9.0');
    await user.click(screen.getByText('Show details'));
    const link = await screen.findByText('evil');
    const anchor = link.closest('a') ?? link;
    // The unsafe href is replaced with '#'
    expect(anchor).toHaveAttribute('href', '#');
  });

  it('FE-ADMIN-GH-016: support card hover effects fire without error', async () => {
    render(<GitHubPanel />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const kofiLink = screen.getByText('Ko-fi').closest('a')!;
    fireEvent.mouseEnter(kofiLink);
    fireEvent.mouseLeave(kofiLink);

    const discordLink = screen.getByText('Discord').closest('a')!;
    fireEvent.mouseEnter(discordLink);
    fireEvent.mouseLeave(discordLink);

    const bugLink = screen.getByText('Report a Bug').closest('a')!;
    fireEvent.mouseEnter(bugLink);
    fireEvent.mouseLeave(bugLink);

    const featureLink = screen.getByText('Feature Request').closest('a')!;
    fireEvent.mouseEnter(featureLink);
    fireEvent.mouseLeave(featureLink);

    const wikiLink = screen.getByText('Wiki').closest('a')!;
    fireEvent.mouseEnter(wikiLink);
    fireEvent.mouseLeave(wikiLink);

    const bmcLink = screen.getByText('Buy Me a Coffee').closest('a')!;
    fireEvent.mouseEnter(bmcLink);
    fireEvent.mouseLeave(bmcLink);

    // All links still visible
    expect(screen.getByText('Ko-fi')).toBeInTheDocument();
  });

  it('FE-ADMIN-GH-012: clicking "Load more" appends next page', async () => {
    server.use(
      http.get('/api/admin/github-releases', ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        if (page === '2') {
          return HttpResponse.json(PAGE_2);
        }
        return HttpResponse.json(PAGE_1);
      }),
    );
    const user = userEvent.setup();
    render(<GitHubPanel />);
    await screen.findByText('v1.0.0');

    // All 10 items from page 1 visible
    expect(screen.getAllByText(/v1\.\d\.0/).length).toBe(10);

    // Click Load more
    await user.click(screen.getByText('Load more'));

    // Wait for page 2 items to appear
    await screen.findByText('v0.0.0');

    // Total: 10 from page 1 + 5 from page 2 = 15
    const tagEls = screen.getAllByText(/^v[01]\.\d\.0$/);
    expect(tagEls.length).toBe(15);

    // Load more should be hidden (PAGE_2 < 10)
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });
});
