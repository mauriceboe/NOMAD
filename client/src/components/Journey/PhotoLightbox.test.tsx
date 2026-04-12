// FE-COMP-LIGHTBOX-001 to FE-COMP-LIGHTBOX-008

vi.mock('../../api/websocket', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSocketId: vi.fn(() => null),
  setRefetchCallback: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

import { render, screen, fireEvent } from '../../../tests/helpers/render';
import { resetAllStores } from '../../../tests/helpers/store';
import PhotoLightbox from './PhotoLightbox';

const samplePhotos = [
  { id: 'p1', src: '/photos/1.jpg', caption: 'Sunset at the beach' },
  { id: 'p2', src: '/photos/2.jpg', caption: 'Mountain trail' },
  { id: 'p3', src: '/photos/3.jpg', caption: null },
];

beforeEach(() => {
  resetAllStores();
});

describe('PhotoLightbox', () => {
  it('FE-COMP-LIGHTBOX-001: renders without crashing when open', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-LIGHTBOX-002: shows photo image', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/photos/1.jpg');
  });

  it('FE-COMP-LIGHTBOX-003: shows close button', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    const buttons = screen.getAllByRole('button');
    // Close button exists (the X button in the top bar)
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('FE-COMP-LIGHTBOX-004: previous/next navigation works', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    // Initially shows photo 1
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/photos/1.jpg');

    // Navigate to next photo via ArrowRight key
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/photos/2.jpg');

    // Navigate back via ArrowLeft key
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/photos/1.jpg');
  });

  it('FE-COMP-LIGHTBOX-005: keyboard Escape closes lightbox', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('FE-COMP-LIGHTBOX-006: counter shows "1 / N"', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('FE-COMP-LIGHTBOX-007: does not render when photos array is empty', () => {
    const onClose = vi.fn();
    const { container } = render(<PhotoLightbox photos={[]} onClose={onClose} />);
    // Component returns null when photo is undefined (empty array, index 0 is undefined)
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('FE-COMP-LIGHTBOX-008: calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PhotoLightbox photos={samplePhotos} onClose={onClose} />);
    // The close button is in the top bar — find the button and click it
    const buttons = screen.getAllByRole('button');
    // The first button in the top bar is the close (X) button
    buttons[0].click();
    expect(onClose).toHaveBeenCalled();
  });
});
