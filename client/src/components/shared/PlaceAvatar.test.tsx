import { render, screen, fireEvent, act } from '../../../tests/helpers/render';
import { getCached, isLoading, fetchPhoto, onThumbReady } from '../../services/photoService';

// Mock photoService — all functions are no-ops / return null
vi.mock('../../services/photoService', () => ({
  getCached: vi.fn(() => null),
  isLoading: vi.fn(() => false),
  fetchPhoto: vi.fn(),
  onThumbReady: vi.fn(() => () => {}),
}));

// Mock IntersectionObserver as a class constructor
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();
let observerInstance: MockIntersectionObserver | null = null;

class MockIntersectionObserver {
  callback: (entries: Partial<IntersectionObserverEntry>[]) => void;
  constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    this.callback = callback;
    observerInstance = this;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}

beforeAll(() => {
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
});

beforeEach(() => {
  vi.mocked(getCached).mockReturnValue(null);
  vi.mocked(isLoading).mockReturnValue(false);
  vi.mocked(fetchPhoto).mockReset();
  vi.mocked(onThumbReady).mockReturnValue(() => {});
});

afterEach(() => {
  mockDisconnect.mockClear();
  mockObserve.mockClear();
  observerInstance = null;
});

import PlaceAvatar from './PlaceAvatar';

const basePlaceNoImage = {
  id: 1,
  name: 'Eiffel Tower',
  image_url: null,
  google_place_id: null,
  osm_id: null,
  lat: 48.8584,
  lng: 2.2945,
};

const basePlaceWithImage = {
  ...basePlaceNoImage,
  image_url: 'https://example.com/eiffel.jpg',
};

describe('PlaceAvatar', () => {
  it('FE-COMP-AVATAR-001: renders an image when image_url is provided', () => {
    render(<PlaceAvatar place={basePlaceWithImage} />);
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect((img as HTMLImageElement).src).toContain('eiffel.jpg');
  });

  it('FE-COMP-AVATAR-002: image has correct alt text equal to place.name', () => {
    render(<PlaceAvatar place={basePlaceWithImage} />);
    const img = screen.getByAltText('Eiffel Tower');
    expect(img).toBeTruthy();
  });

  it('FE-COMP-AVATAR-003: renders an icon (no img) when no image_url', () => {
    render(<PlaceAvatar place={basePlaceNoImage} />);
    expect(screen.queryByRole('img')).toBeNull();
    // The wrapper div should still be present
    const { container } = render(<PlaceAvatar place={basePlaceNoImage} />);
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('FE-COMP-AVATAR-004: uses category color as background color', () => {
    const { container } = render(
      <PlaceAvatar place={basePlaceWithImage} category={{ color: '#ff5733', icon: 'MapPin' }} />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toBe('rgb(255, 87, 51)');
  });

  it('FE-COMP-AVATAR-005: uses default indigo color when no category provided', () => {
    const { container } = render(<PlaceAvatar place={basePlaceWithImage} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.backgroundColor).toBe('rgb(99, 102, 241)');
  });

  it('FE-COMP-AVATAR-006: falls back to icon when image fails to load', () => {
    render(<PlaceAvatar place={basePlaceWithImage} />);
    const img = screen.getByRole('img');
    // Simulate image load error
    act(() => {
      fireEvent.error(img);
    });
    // After error, img is removed and icon takes over
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('FE-COMP-AVATAR-007: respects the size prop for container dimensions', () => {
    const { container } = render(<PlaceAvatar place={basePlaceWithImage} size={64} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe('64px');
    expect(wrapper.style.height).toBe('64px');
  });

  it('FE-COMP-AVATAR-008: default size is 32px when size prop is omitted', () => {
    const { container } = render(<PlaceAvatar place={basePlaceWithImage} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.width).toBe('32px');
    expect(wrapper.style.height).toBe('32px');
  });

  it('FE-COMP-AVATAR-009: uses category icon (SVG) when no category provided', () => {
    const { container } = render(<PlaceAvatar place={basePlaceNoImage} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('FE-COMP-AVATAR-010: uses category-specific icon when category.icon is set', () => {
    const { container } = render(
      <PlaceAvatar place={basePlaceNoImage} category={{ icon: 'MapPin', color: '#ff0000' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('FE-COMP-AVATAR-011: calls fetchPhoto when visible and no image_url, no cache', () => {
    render(<PlaceAvatar place={basePlaceNoImage} />);

    act(() => {
      observerInstance?.callback([{ isIntersecting: true }]);
    });

    expect(vi.mocked(fetchPhoto)).toHaveBeenCalled();
  });

  it('FE-COMP-AVATAR-012: sets photoSrc from cached thumbnail when cache hit', () => {
    vi.mocked(getCached).mockReturnValue({ thumbDataUrl: 'data:image/jpeg;base64,abc', photoUrl: null } as any);

    const { container } = render(
      <PlaceAvatar place={{ ...basePlaceNoImage, google_place_id: 'gid123' }} />
    );

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain('data:image/jpeg;base64,abc');
  });

  it('FE-COMP-AVATAR-013: registers onThumbReady callback when photo is loading', () => {
    vi.mocked(getCached).mockReturnValue(null);
    vi.mocked(isLoading).mockReturnValue(true);

    render(<PlaceAvatar place={{ ...basePlaceNoImage, google_place_id: 'gid456' }} />);

    act(() => {
      observerInstance?.callback([{ isIntersecting: true }]);
    });

    expect(vi.mocked(onThumbReady)).toHaveBeenCalledWith('gid456', expect.any(Function));
  });

  it('FE-COMP-AVATAR-014: does not call fetchPhoto when image_url is set', () => {
    render(<PlaceAvatar place={basePlaceWithImage} />);
    expect(vi.mocked(fetchPhoto)).not.toHaveBeenCalled();
  });

  it('FE-COMP-AVATAR-015: IntersectionObserver disconnected on unmount', () => {
    const { unmount } = render(<PlaceAvatar place={basePlaceNoImage} />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('FE-COMP-AVATAR-016: does not set up IntersectionObserver when image_url present', () => {
    render(<PlaceAvatar place={basePlaceWithImage} />);
    expect(mockObserve).not.toHaveBeenCalled();
  });
});
