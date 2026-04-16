import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Response } from 'express';
import { canAccessTrip, db } from "../../db/database";
import { safeFetch, SsrfBlockedError } from '../../utils/ssrfGuard';

// helpers for handling return types

type ServiceError = { success: false; error: { message: string; status: number } };
export type ServiceResult<T> = { success: true; data: T } | ServiceError;


export function fail(error: string, status: number): ServiceError {
    return { success: false, error: { message: error, status } };
}


export function success<T>(data: T): ServiceResult<T> {
    return { success: true, data: data };
}


export function mapDbError(error: Error, fallbackMessage: string): ServiceError {
    if (error && /unique|constraint/i.test(error.message)) {
        return fail('Resource already exists', 409);
    }
    return fail(error.message, 500);
}


export function handleServiceResult<T>(res: Response, result: ServiceResult<T>): void {
    if ('error' in result) {
        res.status(result.error.status).json({ error: result.error.message });
    }
    else {
        res.json(result.data);
    }
}

// ----------------------------------------------
// types used across memories services
export type Selection = {
    provider: string;
    asset_ids: string[];
    cache_keys?: (string | null)[];
    passphrase?: string | null;
};

export type StatusResult = {
    connected: true;
    user: { name: string }
} | {
    connected: false;
    error: string
};

export type SyncAlbumResult = {
    added: number;
    total: number
};


export type AlbumsList = {
    albums: Array<{ id: string; albumName: string; assetCount: number }>
};

export type Asset = {
    id: string;
    cacheKey?: string | null;
    takenAt: string;
    passphrase?: string | null;
};

export type AssetsList = {
    assets: Asset[],
    total: number,
    hasMore: boolean
};


export type AssetInfo = {
    id: string;
    takenAt: string | null;
    city: string | null;
    country: string | null;
    state?: string | null;
    camera?: string | null;
    lens?: string | null;
    focalLength?: string | number | null;
    aperture?: string | number | null;
    shutter?: string | number | null;
    iso?: string | number | null;
    lat?: number | null;
    lng?: number | null;
    orientation?: number | null;
    description?: string | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
    fileName?: string | null;
}

export type AssetSize = 'thumbnail' | 'preview' | 'fullsize' | 'original';

//for loading routes to settings page, and validating which services user has connected
type PhotoProviderConfig = {
    settings_get: string;
    settings_put: string;
    status_get: string;
    test_post: string;
};


export function getPhotoProviderConfig(providerId: string): PhotoProviderConfig {
    const prefix = `/integrations/memories/${providerId}`;
    return {
        settings_get: `${prefix}/settings`,
        settings_put: `${prefix}/settings`,
        status_get: `${prefix}/status`,
        test_post: `${prefix}/test`,
    };
}

//-----------------------------------------------
//access check helper

export function canAccessUserPhoto(requestingUserId: number, ownerUserId: number, tripId: string, assetId: string, provider: string): boolean {
    if (requestingUserId === ownerUserId) {
        return true;
    }

    // Journey photos use tripId=0 — check journey_photos + journey_contributors
    if (tripId === '0') {
        const journeyPhoto = db.prepare(`
            SELECT jp.entry_id, je.journey_id
            FROM journey_photos jp
            JOIN trek_photos tkp ON tkp.id = jp.photo_id
            JOIN journey_entries je ON je.id = jp.entry_id
                        WHERE (tkp.asset_id = ? OR tkp.cache_key = ?)
              AND tkp.provider = ?
              AND tkp.owner_id = ?
            LIMIT 1
                `).get(assetId, assetId, provider, ownerUserId) as { entry_id: number; journey_id: number } | undefined;
        if (!journeyPhoto) return false;

        const access = db.prepare(`
            SELECT 1 FROM journeys WHERE id = ? AND user_id = ?
            UNION ALL
            SELECT 1 FROM journey_contributors WHERE journey_id = ? AND user_id = ?
            LIMIT 1
        `).get(journeyPhoto.journey_id, requestingUserId, journeyPhoto.journey_id, requestingUserId);
        return !!access;
    }

    // Regular trip photos — join through trek_photos
    const sharedAsset = db.prepare(`
    SELECT 1
    FROM trip_photos tp
    JOIN trek_photos tkp ON tkp.id = tp.photo_id
    WHERE tp.user_id = ?
            AND (tkp.asset_id = ? OR tkp.cache_key = ?)
      AND tkp.provider = ?
      AND tp.trip_id = ?
      AND tp.shared = 1
    LIMIT 1
        `).get(ownerUserId, assetId, assetId, provider, tripId);

    if (!sharedAsset) {
        return false;
    }
    return !!canAccessTrip(tripId, requestingUserId);
}


// ── Unified photo access check (trek_photos based) ──────────────────────

export function canAccessTrekPhoto(requestingUserId: number, trekPhotoId: number): boolean {
    const photo = db.prepare('SELECT * FROM trek_photos WHERE id = ?').get(trekPhotoId) as { id: number; provider: string; owner_id: number | null } | undefined;
    if (!photo) return false;

    // Owner always has access
    if (photo.owner_id === requestingUserId) return true;

    // Check trip_photos — is this photo shared in a trip the user has access to?
    const tripAccess = db.prepare(`
        SELECT 1 FROM trip_photos tp
        WHERE tp.photo_id = ?
          AND tp.shared = 1
          AND EXISTS (
            SELECT 1 FROM trip_members tm WHERE tm.trip_id = tp.trip_id AND tm.user_id = ?
            UNION ALL
            SELECT 1 FROM trips t WHERE t.id = tp.trip_id AND t.user_id = ?
          )
        LIMIT 1
    `).get(trekPhotoId, requestingUserId, requestingUserId);
    if (tripAccess) return true;

    // Check journey_photos — is this photo in a journey the user can access?
    const journeyAccess = db.prepare(`
        SELECT 1 FROM journey_photos jp
        JOIN journey_entries je ON je.id = jp.entry_id
        WHERE jp.photo_id = ?
          AND EXISTS (
            SELECT 1 FROM journeys j WHERE j.id = je.journey_id AND j.user_id = ?
            UNION ALL
            SELECT 1 FROM journey_contributors jc WHERE jc.journey_id = je.journey_id AND jc.user_id = ?
          )
        LIMIT 1
    `).get(trekPhotoId, requestingUserId, requestingUserId);
    if (journeyAccess) return true;

    // Local photos without owner (uploaded files) — check if user has journey access
    if (photo.provider === 'local' && !photo.owner_id) {
        return !!journeyAccess;
    }

    return false;
}


// ----------------------------------------------
//helpers for album link syncing

export function getAlbumIdFromLink(tripId: string, linkId: string, userId: number): ServiceResult<string> {
    const access = canAccessTrip(tripId, userId);
    if (!access) return fail('Trip not found or access denied', 404);

    try {
        const row = db.prepare('SELECT album_id FROM trip_album_links WHERE id = ? AND trip_id = ? AND user_id = ?')
            .get(linkId, tripId, userId) as { album_id: string } | null;

        return row ? success(row.album_id) : fail('Album link not found', 404);
    } catch {
        return fail('Failed to retrieve album link', 500);
    }
}

export function updateSyncTimeForAlbumLink(linkId: string): void {
    db.prepare('UPDATE trip_album_links SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?').run(linkId);
}

export async function pipeAsset(url: string, response: Response, headers?: Record<string, string>, signal?: AbortSignal): Promise<void> {
    try {
        const resp = await safeFetch(url, { headers, signal: signal as any });

        response.set('Cache-Control', 'public, max-age=86400');
        response.status(resp.status);
        if (resp.headers.get('content-type')) response.set('Content-Type', resp.headers.get('content-type') as string);
        if (resp.headers.get('cache-control')) response.set('Cache-Control', resp.headers.get('cache-control') as string);
        if (resp.headers.get('content-length')) response.set('Content-Length', resp.headers.get('content-length') as string);
        if (resp.headers.get('content-disposition')) response.set('Content-Disposition', resp.headers.get('content-disposition') as string);
        
        if (!resp.body) {
            response.end();
        } else {
            await pipeline(Readable.fromWeb(resp.body as any), response);
        }
    } catch (error) {
        if (response.headersSent) {
            response.end();
            return;
        }
        if (error instanceof SsrfBlockedError) {
            response.status(400).json({ error: error.message });
        } else {
            response.status(500).json({ error: 'Failed to fetch asset' });
        }
    }
}