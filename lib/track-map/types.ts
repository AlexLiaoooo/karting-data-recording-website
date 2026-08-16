/** The phases of a corner, plus the two pedal inputs. */
export type TrackMarkerType = "In" | "Mid" | "Out" | "Brake" | "Gas";

/**
 * A named corner on a layout, in lap order. Positions are normalised to the map asset box,
 * the same convention as TrackMarker, so both survive the image being displayed at any size.
 */
export type TrackCorner = {
  number: number;
  /** Short form shown on the map, e.g. "T7". Kept brief so it stays legible at map scale. */
  label: string;
  x: number;
  y: number;
};

export type Track = {
  id: string;
  name: string;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackMarker = {
  id: string;
  x: number;
  y: number;
  order: number;
  label: string;
  type: TrackMarkerType;
  shortInstruction: string;
  generalNote: string;
  dryNote: string;
  wetNote: string;
  tags: string[];
  updatedAt: string;
};

export type TrackLayout = {
  id: string;
  trackId: string;
  name: string;
  direction: "Clockwise" | "Anti-clockwise" | "Unknown";
  mapAssetId: string | null;
  sourceAttribution?: string;
  sourceUrl?: string;
  /** Set only while the layout carries an app-supplied map; see lib/track-map/built-in-map.ts. */
  builtInMapVersion?: string;
  /** Lap-ordered corners used for labelling the map and placing markers by corner. */
  corners?: TrackCorner[];
  /** Free-form notes about the layout as a whole, rather than about one marker. */
  notes?: string;
  markers: TrackMarker[];
  createdAt: string;
  updatedAt: string;
};

export type MarkerObservation = {
  id: string;
  markerId: string;
  sessionId: string;
  note: string;
  result: "" | "Better" | "Same" | "Worse";
  createdAt: string;
  updatedAt: string;
};

export type TrackVisit = {
  id: string;
  layoutId: string;
  eventId: string;
  sessionId: string;
  date: string;
  condition: "Dry" | "Damp" | "Wet" | "Mixed";
  observations: MarkerObservation[];
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type MapAsset = {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  size: number;
  updatedAt: string;
};

export type TrackMapData = {
  version: 1;
  tracks: Track[];
  layouts: TrackLayout[];
  visits: TrackVisit[];
  assets: MapAsset[];
};

export const markerTypes: TrackMarkerType[] = ["In", "Mid", "Out", "Brake", "Gas"];

/**
 * Marker types used before the list was reduced to corner phases and pedal inputs. Entry,
 * apex and exit map straight across; the rest were not phases of a corner at all, so they
 * become "Mid" and their original type is preserved in the marker's general note.
 */
export const legacyMarkerTypes: Record<string, { type: TrackMarkerType; keepsMeaning: boolean }> = {
  "Turn-in": { type: "In", keepsMeaning: true },
  Apex: { type: "Mid", keepsMeaning: true },
  Exit: { type: "Out", keepsMeaning: true },
  Braking: { type: "Brake", keepsMeaning: true },
  Corner: { type: "Mid", keepsMeaning: false },
  Hazard: { type: "Mid", keepsMeaning: false },
  Overtaking: { type: "Mid", keepsMeaning: false },
  Focus: { type: "Mid", keepsMeaning: false },
};

export const emptyTrackMapData = (): TrackMapData => ({
  version: 1,
  tracks: [],
  layouts: [],
  visits: [],
  assets: [],
});
