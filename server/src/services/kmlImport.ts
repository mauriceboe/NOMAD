import { TextDecoder } from 'util';

export interface ParsedKmlPlacemark {
  name: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  folderName: string | null;
}

export interface KmlPlacemarkNode {
  placemark: any;
  folderName: string | null;
}

export interface KmlImportSummary {
  totalPlacemarks: number;
  createdCount: number;
  skippedCount: number;
  warnings: string[];
  errors: string[];
}

const UTF8_DECODER_FATAL = new TextDecoder('utf-8', { fatal: true });
const UTF8_DECODER_LOOSE = new TextDecoder('utf-8');

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function decodeHtmlEntities(value: string): string {
  const withNamedEntities = value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITY_MAP[m] || m);

  return withNamedEntities
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

export function stripXmlNamespaces(xml: string): string {
  // KML exports vary heavily; stripping namespace declarations/prefixes makes parsing resilient.
  return xml
    .replace(/\sxmlns(:\w+)?="[^"]*"/g, '')
    .replace(/\sxmlns(:\w+)?='[^']*'/g, '')
    .replace(/<(\/?)\w+:/g, '<$1');
}

export function decodeUtf8WithWarning(fileBuffer: Buffer): { text: string; warning: string | null } {
  try {
    return { text: UTF8_DECODER_FATAL.decode(fileBuffer), warning: null };
  } catch {
    return {
      text: UTF8_DECODER_LOOSE.decode(fileBuffer),
      warning: 'The uploaded file is not valid UTF-8. Some characters may be shown incorrectly.',
    };
  }
}

export function sanitizeKmlDescription(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  const withLineBreaks = raw.replace(/<br\s*\/?>/gi, '\n');
  const stripped = withLineBreaks.replace(/<[^>]+>/g, '');
  const decoded = decodeHtmlEntities(stripped)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decoded || null;
}

export function parseKmlPointCoordinates(value: unknown): { lat: number; lng: number } | null {
  const coordinates = asTrimmedString(value);
  if (!coordinates) return null;

  const firstCoordinate = coordinates.split(/\s+/)[0];
  const [lngRaw, latRaw] = firstCoordinate.split(',');
  if (lngRaw == null || latRaw == null) return null;

  const lng = Number.parseFloat(lngRaw);
  const lat = Number.parseFloat(latRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function createKmlImportSummary(totalPlacemarks: number): KmlImportSummary {
  return {
    totalPlacemarks,
    createdCount: 0,
    skippedCount: 0,
    warnings: [],
    errors: [],
  };
}

export function buildCategoryNameLookup(categories: { id: number; name: string }[]): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const category of categories) {
    const normalizedName = category.name.trim().toLowerCase();
    if (!normalizedName) continue;
    if (!lookup.has(normalizedName)) {
      lookup.set(normalizedName, category.id);
    }
  }
  return lookup;
}

export function resolveCategoryIdForFolder(folderName: string | null, lookup: Map<string, number>): number | null {
  if (!folderName) return null;
  const normalizedFolder = folderName.trim().toLowerCase();
  if (!normalizedFolder) return null;
  return lookup.get(normalizedFolder) ?? null;
}

export function extractKmlPlacemarkNodes(kmlRoot: any): KmlPlacemarkNode[] {
  const nodes: KmlPlacemarkNode[] = [];

  const visitNode = (node: any, currentFolderName: string | null): void => {
    if (!node || typeof node !== 'object') return;

    for (const placemark of asArray(node.Placemark)) {
      nodes.push({ placemark, folderName: currentFolderName });
    }

    for (const folder of asArray(node.Folder)) {
      // Nested folders inherit/override folder context used for category matching.
      const folderName = asTrimmedString(folder?.name) || currentFolderName;
      visitNode(folder, folderName);
    }

    for (const childDocument of asArray(node.Document)) {
      visitNode(childDocument, currentFolderName);
    }
  };

  visitNode(kmlRoot, null);
  return nodes;
}

export function parsePlacemarkNode(node: KmlPlacemarkNode): ParsedKmlPlacemark {
  const coordinates = parseKmlPointCoordinates(node.placemark?.Point?.coordinates);

  return {
    name: asTrimmedString(node.placemark?.name),
    description: sanitizeKmlDescription(node.placemark?.description),
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    folderName: node.folderName,
  };
}
