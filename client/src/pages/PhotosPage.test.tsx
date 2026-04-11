import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '../../tests/helpers/render';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../tests/helpers/msw/server';
import { resetAllStores, seedStore } from '../../tests/helpers/store';
import { buildUser, buildTrip } from '../../tests/helpers/factories';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import PhotosPage from './PhotosPage';
import type { Photo } from '../types';

vi.mock('../components/Photos/PhotoGallery', () => ({
  default: ({ photos }: { photos: Photo[]; onUpload: unknown; onDelete: unknown; onUpdate: unknown; places: unknown[]; days: unknown[]; tripId: unknown }) =>
    React.createElement('div', { 'data-testid': 'photo-gallery' }, `${photos.length} photos`),
}));

vi.mock('../components/Layout/Navbar', () => ({
  default: ({ tripTitle }: { tripTitle?: string }) =>
    React.createElement('nav', { 'data-testid': 'navbar' }, tripTitle),
}));

function buildPhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    trip_id: 1,
    filename: 'photo1.jpg',
    original_name: 'photo1.jpg',
    mime_type: 'image/jpeg',
    size: 12345,
    caption: null,
    place_id: null,
    day_id: null,
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPhotosPage(tripId: number | string = 1) {
  return render(
    <Routes>
      <Route path="/trips/:id/photos" element={<PhotosPage />} />
    </Routes>,
    { initialEntries: [`/trips/${tripId}/photos`] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAllStores();
  seedStore(useAuthStore, { isAuthenticated: true, user: buildUser() });
  seedStore(useTripStore, {
    photos: [],
    loadPhotos: vi.fn().mockResolvedValue(undefined),
    addPhoto: vi.fn().mockResolvedValue(undefined),
    deletePhoto: vi.fn().mockResolvedValue(undefined),
    updatePhoto: vi.fn().mockResolvedValue(undefined),
  } as any);
});

describe('PhotosPage', () => {
  describe('FE-PAGE-PHOTOS-001: Loading spinner shown while data fetches', () => {
    it('shows a spinner while data is loading', async () => {
      server.use(
        http.get('/api/trips/:id', async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          const trip = buildTrip({ id: 1 });
          return HttpResponse.json({ trip });
        }),
      );

      renderPhotosPage(1);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-PHOTOS-002: Trip name in Navbar after load', () => {
    it('passes the trip name to Navbar after data loads', async () => {
      const trip = buildTrip({ id: 1, name: 'Venice Trip' });
      server.use(
        http.get('/api/trips/:id', () => HttpResponse.json({ trip })),
      );

      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('navbar')).toHaveTextContent('Venice Trip');
      });
    });
  });

  describe('FE-PAGE-PHOTOS-003: PhotoGallery renders after load', () => {
    it('renders the PhotoGallery after data loads', async () => {
      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PHOTOS-004: Photo count shown in header', () => {
    it('shows the correct photo count in the header', async () => {
      const photo = buildPhoto({ id: 1, trip_id: 1 });
      seedStore(useTripStore, {
        photos: [photo],
        loadPhotos: vi.fn().mockResolvedValue(undefined),
        addPhoto: vi.fn().mockResolvedValue(undefined),
        deletePhoto: vi.fn().mockResolvedValue(undefined),
        updatePhoto: vi.fn().mockResolvedValue(undefined),
      } as any);

      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });

      expect(screen.getByText(/1 Fotos/)).toBeInTheDocument();
    });
  });

  describe('FE-PAGE-PHOTOS-005: Back link navigates to trip planner', () => {
    it('back link points to the trip planner page', async () => {
      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });

      const backLink = screen.getByRole('link', { name: /back to planning/i });
      expect(backLink.getAttribute('href')).toContain('/trips/1');
    });
  });

  describe('FE-PAGE-PHOTOS-006: loadPhotos called with trip ID on mount', () => {
    it('calls tripStore.loadPhotos with the trip ID from the URL', async () => {
      const mockLoadPhotos = vi.fn().mockResolvedValue(undefined);
      seedStore(useTripStore, {
        photos: [],
        loadPhotos: mockLoadPhotos,
        addPhoto: vi.fn().mockResolvedValue(undefined),
        deletePhoto: vi.fn().mockResolvedValue(undefined),
        updatePhoto: vi.fn().mockResolvedValue(undefined),
      } as any);

      renderPhotosPage(1);

      await waitFor(() => {
        expect(mockLoadPhotos).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('FE-PAGE-PHOTOS-007: Navigation to /dashboard on fetch error', () => {
    it('navigates to /dashboard when trip fetch fails', async () => {
      server.use(
        http.get('/api/trips/:id', () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );

      render(
        <Routes>
          <Route path="/trips/:id/photos" element={<PhotosPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>,
        { initialEntries: ['/trips/1/photos'] },
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('FE-PAGE-PHOTOS-008: Photos sync from tripStore to local state', () => {
    it('PhotoGallery re-renders when store photos change', async () => {
      seedStore(useTripStore, {
        photos: [],
        loadPhotos: vi.fn().mockResolvedValue(undefined),
        addPhoto: vi.fn().mockResolvedValue(undefined),
        deletePhoto: vi.fn().mockResolvedValue(undefined),
        updatePhoto: vi.fn().mockResolvedValue(undefined),
      } as any);

      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });

      expect(screen.getByTestId('photo-gallery')).toHaveTextContent('0 photos');

      act(() => {
        useTripStore.setState({ photos: [buildPhoto({ id: 99 })] } as any);
      });

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toHaveTextContent('1 photos');
      });
    });
  });

  describe('FE-PAGE-PHOTOS-009: Empty photo list renders gallery with 0 photos', () => {
    it('renders PhotoGallery with 0 photos when photos array is empty', async () => {
      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });

      expect(screen.getByTestId('photo-gallery')).toHaveTextContent('0 photos');
    });
  });

  describe('FE-PAGE-PHOTOS-010: Page heading present', () => {
    it('renders the "Fotos" heading', async () => {
      renderPhotosPage(1);

      await waitFor(() => {
        expect(screen.getByTestId('photo-gallery')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /fotos/i })).toBeInTheDocument();
    });
  });
});
