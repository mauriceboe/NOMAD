// FE-PAGE-PUBLICJOURNEY-001 to FE-PAGE-PUBLICJOURNEY-010
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '../../tests/helpers/render';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores, seedStore } from '../../tests/helpers/store';
import { useSettingsStore } from '../store/settingsStore';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ token: 'test-share-token' }) };
});

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: any) => <div>{children}</div>,
  Popup: ({ children }: any) => <div>{children}</div>,
  Polyline: () => null,
  useMap: () => ({ fitBounds: vi.fn(), setView: vi.fn() }),
}));

vi.mock('leaflet', () => {
  const L = {
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
    icon: vi.fn(() => ({})),
  };
  return { default: L, ...L };
});

vi.mock('react-dom/server', () => ({
  renderToStaticMarkup: vi.fn(() => '<svg></svg>'),
}));

// Mock JourneyMap since it uses vanilla Leaflet (L.map) which requires a real DOM
vi.mock('../components/Journey/JourneyMap', () => ({
  default: ({ entries }: any) => <div data-testid="journey-map">Map with {entries?.length || 0} entries</div>,
}));

vi.mock('../components/Journey/JournalBody', () => ({
  default: ({ text }: { text: string }) => <div data-testid="journal-body">{text}</div>,
}));

vi.mock('../components/Journey/PhotoLightbox', () => ({
  default: ({ photos, onClose }: any) => (
    <div data-testid="photo-lightbox">
      <span>{photos.length} photos</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import JourneyPublicPage from './JourneyPublicPage';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const mockJourneyData = {
  journey: {
    id: 1,
    user_id: 1,
    title: 'Tokyo 2026',
    subtitle: 'Spring trip to Japan',
    status: 'active',
    cover_image: null,
  },
  entries: [
    {
      id: 10,
      title: 'Shibuya Crossing',
      story: 'The most famous crossing in the world.',
      entry_date: '2026-03-15',
      entry_time: '14:00',
      location_name: 'Shibuya, Tokyo',
      location_lat: 35.6595,
      location_lng: 139.7004,
      mood: 'excited',
      weather: 'sunny',
      pros_cons: null,
      photos: [],
    },
    {
      id: 11,
      title: 'Senso-ji Temple',
      story: 'Beautiful ancient temple.',
      entry_date: '2026-03-16',
      entry_time: '10:00',
      location_name: 'Asakusa, Tokyo',
      location_lat: 35.7148,
      location_lng: 139.7967,
      mood: 'peaceful',
      weather: 'cloudy',
      pros_cons: null,
      photos: [
        { id: 100, entry_id: 11, provider: 'local', asset_id: null, owner_id: null, file_path: 'journey/temple.jpg', caption: 'Temple entrance' },
      ],
    },
  ],
  permissions: {
    share_timeline: true,
    share_gallery: true,
    share_map: true,
  },
  stats: {
    entries: 2,
    photos: 1,
    cities: 2,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSuccess() {
  server.use(
    http.get('/api/public/journey/test-share-token', () =>
      HttpResponse.json(mockJourneyData),
    ),
  );
}

function setup404() {
  server.use(
    http.get('/api/public/journey/test-share-token', () =>
      new HttpResponse(null, { status: 404 }),
    ),
  );
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('JourneyPublicPage', () => {
  it('FE-PAGE-PUBLICJOURNEY-001: renders without crashing', () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-PAGE-PUBLICJOURNEY-002: shows journey title after loading', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });
  });

  it('FE-PAGE-PUBLICJOURNEY-003: shows 404 for invalid/missing token', async () => {
    setup404();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      // The component shows the notFound heading when fetch errors
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('FE-PAGE-PUBLICJOURNEY-004: timeline tab is the default view', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });
    // Entry titles from the timeline should be visible
    expect(screen.getByText('Shibuya Crossing')).toBeInTheDocument();
    expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument();
  });

  it('FE-PAGE-PUBLICJOURNEY-005: shows entry cards with titles', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Shibuya Crossing')).toBeInTheDocument();
    });
    expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument();
    // Entry story text should render
    expect(screen.getByText('The most famous crossing in the world.')).toBeInTheDocument();
  });

  it('FE-PAGE-PUBLICJOURNEY-006: shows read-only badge text', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });
    // The page renders a t('journey.public.readOnly') div with inline style textTransform: 'uppercase'
    // The translation key resolves to the English text in the real TranslationProvider
    const readOnlyEl = document.querySelector('[style*="uppercase"]');
    expect(readOnlyEl).toBeInTheDocument();
  });

  it('FE-PAGE-PUBLICJOURNEY-007: shows footer with shared-via branding', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });
    // Footer shows "TREK" brand and "Made with" text
    expect(screen.getByText('TREK')).toBeInTheDocument();
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('FE-PAGE-PUBLICJOURNEY-008: gallery tab switches view', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Find the gallery tab button — the view tabs contain icons and labels
    const buttons = screen.getAllByRole('button');
    const galleryBtn = buttons.find(
      btn => btn.textContent && /gallery/i.test(btn.textContent),
    );
    expect(galleryBtn).toBeDefined();
    if (galleryBtn) {
      fireEvent.click(galleryBtn);
      // After switching to gallery, timeline entry titles should no longer be visible
      // Gallery shows a grid of photos instead
      await waitFor(() => {
        const grid = document.querySelector('.grid');
        expect(grid).toBeInTheDocument();
      });
    }
  });

  it('FE-PAGE-PUBLICJOURNEY-009: map tab switches view', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const mapBtn = buttons.find(
      btn => btn.textContent && /map/i.test(btn.textContent),
    );
    expect(mapBtn).toBeDefined();
    if (mapBtn) {
      fireEvent.click(mapBtn);
      // After clicking map tab, the timeline entries should no longer be visible
      // and the map view content should be rendered (even if JourneyMap errors internally
      // due to jsdom limitations, the tab state switches)
      await waitFor(() => {
        // Shibuya Crossing (timeline-only) should not appear once map is active
        expect(screen.queryByText('Shibuya Crossing')).not.toBeInTheDocument();
      });
    }
  });

  it('FE-PAGE-PUBLICJOURNEY-010: shows journey stats', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });
    // Stats pill: "2 Entries", "1 Photos", "2 Places"
    // The numbers appear alongside translation keys inside a pill with blur(4px) backdrop
    // Use querySelectorAll to find the right one (not the language picker which also has backdrop-filter)
    const allBackdrop = document.querySelectorAll('[style*="backdrop-filter"]');
    // The stats pill contains the entry/photo/city counts
    const statsContainer = Array.from(allBackdrop).find(
      el => el.textContent && el.textContent.includes('1') && el.children.length > 3,
    );
    expect(statsContainer).toBeDefined();
    expect(statsContainer!.textContent).toContain('2');
    expect(statsContainer!.textContent).toContain('1');
  });

  // FE-PAGE-PUBLICJOURNEY-011
  it('FE-PAGE-PUBLICJOURNEY-011: tab switching from timeline to gallery hides entry titles', async () => {
    const user = userEvent.setup();
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Timeline entries visible
    expect(screen.getByText('Shibuya Crossing')).toBeInTheDocument();

    // Switch to gallery
    const galleryBtn = screen.getAllByRole('button').find(
      btn => btn.textContent && /gallery/i.test(btn.textContent),
    );
    expect(galleryBtn).toBeDefined();
    await user.click(galleryBtn!);

    // Timeline entries should be gone
    await waitFor(() => {
      expect(screen.queryByText('Shibuya Crossing')).not.toBeInTheDocument();
    });
  });

  // FE-PAGE-PUBLICJOURNEY-012
  it('FE-PAGE-PUBLICJOURNEY-012: tab switching from timeline to map shows map component', async () => {
    const user = userEvent.setup();
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    const mapBtn = screen.getAllByRole('button').find(
      btn => btn.textContent && /map/i.test(btn.textContent),
    );
    expect(mapBtn).toBeDefined();
    await user.click(mapBtn!);

    await waitFor(() => {
      expect(screen.getByTestId('journey-map')).toBeInTheDocument();
    });
    // Map receives entries with lat/lng
    expect(screen.getByTestId('journey-map').textContent).toContain('2');
  });

  // FE-PAGE-PUBLICJOURNEY-013
  it('FE-PAGE-PUBLICJOURNEY-013: entry card renders location name', async () => {
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    expect(screen.getByText('Shibuya, Tokyo')).toBeInTheDocument();
    expect(screen.getByText('Asakusa, Tokyo')).toBeInTheDocument();
  });

  // FE-PAGE-PUBLICJOURNEY-014
  it('FE-PAGE-PUBLICJOURNEY-014: photo grid renders in gallery view', async () => {
    const user = userEvent.setup();

    const richData = {
      ...mockJourneyData,
      entries: [
        {
          id: 20, title: 'Photo Entry', story: null, entry_date: '2026-03-15',
          entry_time: null, location_name: null, location_lat: null, location_lng: null,
          mood: null, weather: null, pros_cons: null,
          photos: [
            { id: 200, entry_id: 20, provider: 'local', asset_id: null, owner_id: null, file_path: 'journey/a.jpg', caption: 'Photo A' },
            { id: 201, entry_id: 20, provider: 'local', asset_id: null, owner_id: null, file_path: 'journey/b.jpg', caption: 'Photo B' },
            { id: 202, entry_id: 20, provider: 'local', asset_id: null, owner_id: null, file_path: 'journey/c.jpg', caption: 'Photo C' },
          ],
        },
      ],
      stats: { entries: 1, photos: 3, cities: 0 },
    };

    server.use(
      http.get('/api/public/journey/test-share-token', () => HttpResponse.json(richData)),
    );

    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Switch to gallery
    const galleryBtn = screen.getAllByRole('button').find(
      btn => btn.textContent && /gallery/i.test(btn.textContent),
    );
    await user.click(galleryBtn!);

    await waitFor(() => {
      // Gallery grid: 3 images rendered
      const images = document.querySelectorAll('.grid img');
      expect(images.length).toBe(3);
    });
  });

  // FE-PAGE-PUBLICJOURNEY-015
  it('FE-PAGE-PUBLICJOURNEY-015: stats display shows entries, photos, and cities counts', async () => {
    const customData = {
      ...mockJourneyData,
      stats: { entries: 14, photos: 83, cities: 7 },
    };
    server.use(
      http.get('/api/public/journey/test-share-token', () => HttpResponse.json(customData)),
    );

    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Stats pill shows "14 Entries", "83 Photos", "7 Places"
    const allBackdrop = document.querySelectorAll('[style*="backdrop-filter"]');
    const statsContainer = Array.from(allBackdrop).find(
      el => el.textContent && el.textContent.includes('14') && el.textContent.includes('83'),
    );
    expect(statsContainer).toBeDefined();
    expect(statsContainer!.textContent).toContain('14');
    expect(statsContainer!.textContent).toContain('83');
    expect(statsContainer!.textContent).toContain('7');
  });

  // FE-PAGE-PUBLICJOURNEY-016
  it('FE-PAGE-PUBLICJOURNEY-016: language picker opens and switches language', async () => {
    const user = userEvent.setup();
    setupSuccess();
    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // The language picker button shows "English" by default
    const langButton = screen.getByText('English');
    expect(langButton).toBeInTheDocument();

    // Open the language picker
    await user.click(langButton);

    // Language options should appear
    await waitFor(() => {
      expect(screen.getByText('Deutsch')).toBeInTheDocument();
      expect(screen.getByText('Español')).toBeInTheDocument();
      expect(screen.getByText('Français')).toBeInTheDocument();
    });

    // Click Deutsch to switch language
    await user.click(screen.getByText('Deutsch'));

    // The picker should close and settings store should be updated
    const settings = useSettingsStore.getState().settings;
    expect(settings.language).toBe('de');
  });

  // FE-PAGE-PUBLICJOURNEY-017
  it('FE-PAGE-PUBLICJOURNEY-017: restricted tabs — only allowed views appear', async () => {
    const restrictedData = {
      ...mockJourneyData,
      permissions: {
        share_timeline: false,
        share_gallery: true,
        share_map: true,
      },
    };
    server.use(
      http.get('/api/public/journey/test-share-token', () => HttpResponse.json(restrictedData)),
    );

    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Timeline tab should not exist
    const buttons = screen.getAllByRole('button');
    const timelineBtn = buttons.find(btn => btn.textContent && /timeline/i.test(btn.textContent));
    expect(timelineBtn).toBeUndefined();

    // Gallery and Map tabs should exist
    const galleryBtn = buttons.find(btn => btn.textContent && /gallery/i.test(btn.textContent));
    const mapBtn = buttons.find(btn => btn.textContent && /map/i.test(btn.textContent));
    expect(galleryBtn).toBeDefined();
    expect(mapBtn).toBeDefined();
  });

  // FE-PAGE-PUBLICJOURNEY-018
  it('FE-PAGE-PUBLICJOURNEY-018: default view set to gallery when timeline not shared', async () => {
    const restrictedData = {
      ...mockJourneyData,
      permissions: {
        share_timeline: false,
        share_gallery: true,
        share_map: true,
      },
    };
    server.use(
      http.get('/api/public/journey/test-share-token', () => HttpResponse.json(restrictedData)),
    );

    render(<JourneyPublicPage />);
    await waitFor(() => {
      expect(screen.getByText('Tokyo 2026')).toBeInTheDocument();
    });

    // Timeline entries should NOT be visible since timeline is disabled
    // The default view should have switched to gallery
    expect(screen.queryByText('Shibuya Crossing')).not.toBeInTheDocument();

    // Gallery grid should be visible (photos from entries)
    await waitFor(() => {
      const images = document.querySelectorAll('.grid img');
      expect(images.length).toBeGreaterThan(0);
    });
  });
});
