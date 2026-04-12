// FE-COMP-JOURNEYPDF-001 to FE-COMP-JOURNEYPDF-006
//
// JourneyBookPDF.tsx exports an async function `downloadJourneyBookPDF(journey)`
// that opens a new browser window and writes a full HTML document into it.
// It does NOT render a React component. Tests verify window.open behaviour.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock `marked` so we don't need the real markdown parser
vi.mock('marked', () => ({
  marked: {
    parse: (str: string) => `<p>${str}</p>`,
  },
}));

import { downloadJourneyBookPDF } from './JourneyBookPDF';
import type { JourneyDetail } from '../../store/journeyStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildJourney(overrides: Partial<JourneyDetail> = {}): JourneyDetail {
  return {
    id: 1,
    user_id: 1,
    title: 'Iceland Ring Road',
    subtitle: 'Two weeks around the island',
    status: 'active',
    cover_image: null,
    cover_gradient: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    entries: [
      {
        id: 10,
        journey_id: 1,
        author_id: 1,
        type: 'entry',
        title: 'Golden Circle',
        story: 'An incredible day of geysers and waterfalls.',
        entry_date: '2026-07-01',
        entry_time: '09:00',
        location_name: 'Thingvellir',
        location_lat: 64.255,
        location_lng: -21.13,
        mood: 'excited',
        weather: 'sunny',
        tags: [],
        pros_cons: { pros: ['Amazing views'], cons: ['Crowded'] },
        visibility: 'private',
        sort_order: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
        source_trip_id: null,
        source_place_id: null,
        source_trip_name: null,
        photos: [
          {
            id: 100,
            entry_id: 10,
            provider: 'local',
            file_path: 'journey/geyser.jpg',
            thumbnail_path: null,
            asset_id: null,
            owner_id: null,
            shared: 0,
            caption: 'Strokkur erupting',
            sort_order: 0,
            created_at: Date.now(),
          },
        ],
      },
    ],
    trips: [],
    contributors: [],
    stats: { entries: 1, photos: 1, cities: 1 },
    ...overrides,
  } as unknown as JourneyDetail;
}

// ── Mock window.open ─────────────────────────────────────────────────────────

let mockWindow: {
  document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  focus: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockWindow = {
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
  };
  vi.spyOn(window, 'open').mockReturnValue(mockWindow as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('downloadJourneyBookPDF', () => {
  it('FE-COMP-JOURNEYPDF-001: opens a new window', async () => {
    await downloadJourneyBookPDF(buildJourney());
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  it('FE-COMP-JOURNEYPDF-002: writes HTML to the new window', async () => {
    await downloadJourneyBookPDF(buildJourney());
    expect(mockWindow.document.write).toHaveBeenCalledTimes(1);
    const html = mockWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('FE-COMP-JOURNEYPDF-003: closes the document after writing', async () => {
    await downloadJourneyBookPDF(buildJourney());
    expect(mockWindow.document.close).toHaveBeenCalledTimes(1);
  });

  it('FE-COMP-JOURNEYPDF-004: HTML contains the journey title', async () => {
    await downloadJourneyBookPDF(buildJourney());
    const html = mockWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('Iceland Ring Road');
  });

  it('FE-COMP-JOURNEYPDF-005: HTML contains entry content', async () => {
    await downloadJourneyBookPDF(buildJourney());
    const html = mockWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('Golden Circle');
    // Story text is rendered via markdown
    expect(html).toContain('An incredible day of geysers and waterfalls.');
    // Pros/cons verdict cards are included
    expect(html).toContain('Amazing views');
    expect(html).toContain('Crowded');
  });

  it('FE-COMP-JOURNEYPDF-006: handles empty entries gracefully', async () => {
    const journey = buildJourney({ entries: [] });
    await downloadJourneyBookPDF(journey);
    expect(window.open).toHaveBeenCalled();
    const html = mockWindow.document.write.mock.calls[0][0] as string;
    expect(html).toContain('Iceland Ring Road');
    // No entry pages, but cover and closing page are still present
    expect(html).toContain('Journey Book');
    expect(html).toContain('The End');
  });
});
