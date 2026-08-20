/** The phases of a corner, the two pedal inputs, and a catch-all for anything else. */
export type TrackMarkerType = "In" | "Mid" | "Out" | "Brake" | "Gas" | "Others";

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
  /** Free text, and empty for a marker identified only by its corner. See markerLabel. */
  label: string;
  /** Set when the marker was placed on a corner; see markerLabel for why it is not the label. */
  cornerNumber?: number;
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
  /** Which built-in circuit this layout came from; see lib/track-map/built-in-maps.ts. */
  builtInLayoutKey?: string;
  /** Set only while the layout carries an app-supplied map; see lib/track-map/built-in-maps.ts. */
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

export const markerTypes: TrackMarkerType[] = ["In", "Mid", "Out", "Brake", "Gas", "Others"];

/**
 * What to call a marker on screen and in an export.
 *
 * A marker placed on a corner stores that corner's number, not a copy of its label, so
 * renumbering a circuit renames every marker on it. Copying the text instead left markers
 * asserting a corner they were no longer on: renumbering Whilton Mill moved eleven corners up by
 * one, and each marker went on claiming the number it was placed under.
 *
 * Free text wins when there is any, so naming a marker yourself is never overwritten by a
 * renumber, and the corner link survives underneath it.
 */
export function markerLabel(marker: TrackMarker, corners: TrackCorner[] = []): string {
  if (marker.label) return marker.label;
  if (marker.cornerNumber === undefined) return "";
  return corners.find((corner) => corner.number === marker.cornerNumber)?.label ?? "";
}

/**
 * Marker types used before the list was reduced. Turn-in, apex, exit and braking map onto
 * their phase; Corner becomes the mid-corner reference closest to it; the rest were never
 * phases of a corner, so they land in "Others". Where the mapping loses meaning, the original
 * type is written into the marker's general note rather than being dropped.
 */
export const legacyMarkerTypes: Record<string, { type: TrackMarkerType; keepsMeaning: boolean }> = {
  "Turn-in": { type: "In", keepsMeaning: true },
  Apex: { type: "Mid", keepsMeaning: true },
  Exit: { type: "Out", keepsMeaning: true },
  Braking: { type: "Brake", keepsMeaning: true },
  Corner: { type: "Mid", keepsMeaning: false },
  Hazard: { type: "Others", keepsMeaning: false },
  Overtaking: { type: "Others", keepsMeaning: false },
  Focus: { type: "Others", keepsMeaning: false },
};

export const emptyTrackMapData = (): TrackMapData => ({
  version: 1,
  tracks: [],
  layouts: [],
  visits: [],
  assets: [],
});
