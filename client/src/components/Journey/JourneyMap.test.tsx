// FE-COMP-JOURNEYMAP-001 to FE-COMP-JOURNEYMAP-006

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

// Leaflet does not work in jsdom — mock the entire library
vi.mock('leaflet', () => {
  const mockMarker = {
    addTo: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    setIcon: vi.fn(),
    setZIndexOffset: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
  };
  const mockMap = {
    remove: vi.fn(),
    invalidateSize: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 10),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  };
  return {
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      marker: vi.fn(() => mockMarker),
      polyline: vi.fn(() => ({ addTo: vi.fn() })),
      divIcon: vi.fn(() => ({})),
      latLngBounds: vi.fn(() => ({})),
    },
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => mockMarker),
    polyline: vi.fn(() => ({ addTo: vi.fn() })),
    divIcon: vi.fn(() => ({})),
    latLngBounds: vi.fn(() => ({})),
  };
});

import React from 'react';
import { render } from '../../../tests/helpers/render';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { useSettingsStore } from '../../store/settingsStore';
import { buildSettings } from '../../../tests/helpers/factories';
import L from 'leaflet';
import JourneyMap from './JourneyMap';
import type { JourneyMapHandle } from './JourneyMap';

const entriesWithCoords = [
  { id: 'e1', lat: 48.8566, lng: 2.3522, title: 'Paris', mood: null, entry_date: '2025-06-01' },
  { id: 'e2', lat: 52.52, lng: 13.405, title: 'Berlin', mood: null, entry_date: '2025-06-02' },
];

const entriesWithoutCoords = [
  { id: 'e3', lat: 0, lng: 0, title: 'Unknown Place', mood: null, entry_date: '2025-06-03' },
];

const mixedEntries = [
  ...entriesWithCoords,
  ...entriesWithoutCoords,
];

beforeEach(() => {
  resetAllStores();
  seedStore(useSettingsStore, { settings: buildSettings() });
  vi.clearAllMocks();
});

describe('JourneyMap', () => {
  it('FE-COMP-JOURNEYMAP-001: renders map container', () => {
    const { container } = render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // The component renders a div with a child div ref for the Leaflet map
    expect(container.firstChild).toBeInTheDocument();
    expect(L.map).toHaveBeenCalled();
  });

  it('FE-COMP-JOURNEYMAP-002: renders markers for entries with coordinates', () => {
    render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // Two entries with valid lat/lng should produce two markers
    expect(L.marker).toHaveBeenCalledTimes(2);
  });

  it('FE-COMP-JOURNEYMAP-003: does not render markers for entries without coordinates', () => {
    render(
      <JourneyMap checkins={[]} entries={entriesWithoutCoords} />
    );
    // Entry with lat=0 and lng=0 is filtered out by buildMarkerItems (if (e.lat && e.lng))
    expect(L.marker).not.toHaveBeenCalled();
  });

  it('FE-COMP-JOURNEYMAP-004: renders polyline connecting entries', () => {
    render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // With 2+ marker items, a route polyline is drawn
    expect(L.polyline).toHaveBeenCalled();
  });

  it('FE-COMP-JOURNEYMAP-005: shows entry title in marker tooltip', () => {
    render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // Each marker calls bindTooltip with the entry label
    const mockMarkerInstance = (L.marker as any).mock.results[0].value;
    expect(mockMarkerInstance.bindTooltip).toHaveBeenCalledWith(
      'Paris',
      expect.objectContaining({ direction: 'top' }),
    );
  });

  it('FE-COMP-JOURNEYMAP-006: exposes imperative handle (focusMarker)', () => {
    const ref = React.createRef<JourneyMapHandle>();
    render(
      <JourneyMap ref={ref} checkins={[]} entries={entriesWithCoords} />
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current!.focusMarker).toBe('function');
    expect(typeof ref.current!.highlightMarker).toBe('function');
  });

  it('FE-COMP-JOURNEYMAP-007: renders SVG pin markers via divIcon', () => {
    render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // Each marker is created with L.divIcon containing SVG html
    expect(L.divIcon).toHaveBeenCalledTimes(2);
    const firstCall = (L.divIcon as any).mock.calls[0][0];
    expect(firstCall.html).toContain('<svg');
    expect(firstCall.html).toContain('</svg>');
    // Marker index label "1" for first entry
    expect(firstCall.html).toContain('>1<');
  });

  it('FE-COMP-JOURNEYMAP-008: renders markers with mood-based entry labels', () => {
    const entriesWithMood = [
      { id: 'e1', lat: 48.8566, lng: 2.3522, title: 'Happy Paris', mood: 'happy', entry_date: '2025-06-01' },
      { id: 'e2', lat: 52.52, lng: 13.405, title: 'Sad Berlin', mood: 'sad', entry_date: '2025-06-02' },
    ];
    render(
      <JourneyMap checkins={[]} entries={entriesWithMood} />
    );
    // Markers are still created (mood does not prevent rendering)
    expect(L.marker).toHaveBeenCalledTimes(2);
    // Tooltips use the entry titles
    const mockMarker1 = (L.marker as any).mock.results[0].value;
    expect(mockMarker1.bindTooltip).toHaveBeenCalledWith(
      'Happy Paris',
      expect.objectContaining({ direction: 'top' }),
    );
    const mockMarker2 = (L.marker as any).mock.results[1].value;
    expect(mockMarker2.bindTooltip).toHaveBeenCalledWith(
      'Sad Berlin',
      expect.objectContaining({ direction: 'top' }),
    );
  });

  it('FE-COMP-JOURNEYMAP-009: draws route polyline connecting multiple markers', () => {
    const threeEntries = [
      { id: 'e1', lat: 48.8566, lng: 2.3522, title: 'Paris', mood: null, entry_date: '2025-06-01' },
      { id: 'e2', lat: 52.52, lng: 13.405, title: 'Berlin', mood: null, entry_date: '2025-06-02' },
      { id: 'e3', lat: 41.9028, lng: 12.4964, title: 'Rome', mood: null, entry_date: '2025-06-03' },
    ];
    render(
      <JourneyMap checkins={[]} entries={threeEntries} />
    );
    // Route polyline is drawn for items.length > 1
    expect(L.polyline).toHaveBeenCalled();
    const polylineCall = (L.polyline as any).mock.calls[0];
    // Should contain coordinates for all three entries
    expect(polylineCall[0].length).toBe(3);
    // Verify dashed style
    expect(polylineCall[1]).toMatchObject({ dashArray: '4 6' });
  });

  it('FE-COMP-JOURNEYMAP-010: fitBounds is called for auto-zoom', () => {
    // Trigger requestAnimationFrame synchronously
    const origRAF = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };

    render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );

    const mockMap = (L.map as any).mock.results[0].value;
    // fitBounds is called inside requestAnimationFrame with the collected coordinates
    expect(mockMap.fitBounds).toHaveBeenCalled();
    expect(L.latLngBounds).toHaveBeenCalled();

    globalThis.requestAnimationFrame = origRAF;
  });

  it('FE-COMP-JOURNEYMAP-011: single entry creates marker but no polyline', () => {
    const singleEntry = [
      { id: 'e1', lat: 48.8566, lng: 2.3522, title: 'Solo Paris', mood: null, entry_date: '2025-06-01' },
    ];
    render(
      <JourneyMap checkins={[]} entries={singleEntry} />
    );
    // One marker created
    expect(L.marker).toHaveBeenCalledTimes(1);
    // No route polyline — polyline is only drawn when items.length > 1
    expect(L.polyline).not.toHaveBeenCalled();
  });

  it('FE-COMP-JOURNEYMAP-012: renders zoom control buttons', () => {
    const { container } = render(
      <JourneyMap checkins={[]} entries={entriesWithCoords} />
    );
    // The component renders zoom in (+) and zoom out (−) buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('+');
    expect(buttons[1].textContent).toBe('−');
  });
});
