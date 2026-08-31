/**
 * Builds the built-in PF International circuit map, and its corner list, from one committed
 * OpenStreetMap extract.
 *
 * Run: node scripts/build-pfi-map.mjs
 * Writes public/maps/pfi-international-owner-driver.svg and prints the TrackCorner[] literal for
 * lib/track-map/built-in-maps.ts, plus the constants the marker migration needs.
 *
 * This replaces scripts/derive-corners.mjs, which read the artwork instead of a source, so the map
 * could never be rebuilt or checked. Two things came out of finally checking it.
 *
 * The first is that the artwork really is PF International. That was worth confirming, because
 * Fulbeck Kart Circuit sits about 800 m away and lands inside any bounding box drawn around this
 * one; an earlier survey of UK circuits mixed the two up. They are told apart by polygon rather
 * than by position, and the naming happens to be a clean second signal: every PF International way
 * is a Sector, every Fulbeck way is a Turn.
 *
 * The second is that the old artwork was stretched. It was fitted to the canvas on each axis
 * independently, so the circuit was drawn 1.65x too wide: 198 m by 396 m of real ground became a
 * shape of aspect 0.83 rather than 0.50. Every other built-in map goes through layout() in
 * lib/circuit-map.mjs, which scales both axes by the same factor, and this one now does too.
 *
 * The corner list is deliberately NOT re-detected. The fifteen corners below are the ones the
 * circuit's owner counts, three of which were placed by hand precisely because curvature detection
 * misses long sweeps; that is knowledge the geometry does not contain. Their positions are stale,
 * though, because they were measured on the stretched drawing. So each is mapped back through the
 * old fit onto the ground, snapped to the rebuilt lap, and re-emitted. Same corners, same numbers,
 * right places.
 */
import { readFileSync } from "node:fs";
import { MARGIN, TRACK_WIDTH, VIEW, layout, nodeKey, pathLength, printCorners, project, renderSvg, round4, writeArtwork } from "./lib/circuit-map.mjs";

const GENERATOR = "scripts/build-pfi-map.mjs";
const OSM = JSON.parse(readFileSync("scripts/data/pf-international-osm.json", "utf8"));
const ways = new Map(OSM.elements.filter((element) => element.type === "way").map((way) => [way.id, way]));

/** The leisure=sports_centre polygon that says this is PF International and not its neighbour. */
const VENUE_WAY = 240643729;
/**
 * The full lap, in tagged direction, grouped into the three sectors OpenStreetMap names.
 *
 * It begins where Sector 3 hands over to Sector 1, which is the start/finish line: unlike the other
 * OpenStreetMap circuits here, this one does not have to fall back on the pit exit, because the
 * sector naming marks the line itself.
 *
 * The colours are the ones the previous artwork used, kept so the map still reads the same way to
 * anyone who knows it. Sector boundaries are information the source records and the other four
 * circuits simply do not have, which is why this map is the only one drawn in more than one colour.
 */
const SECTORS = [
  { label: "Sector 1", stroke: "#3b82f6", ways: [1208588289, 517085040, 1208588288] },
  { label: "Sector 2", stroke: "#f59e0b", ways: [240643724] },
  { label: "Sector 3", stroke: "#22c55e", ways: [1208588290] },
];
const LAP_WAYS = SECTORS.flatMap((sector) => sector.ways);
/** The pit lane, in travel order: it leaves Sector 3 and rejoins it. */
const PIT_WAYS = [479318583, 1208588286, 1208588285];

/**
 * The fifteen corners, as vertex numbers along the lap below.
 *
 * They are recorded this way, rather than as positions, because a position is only meaningful next
 * to the drawing it was measured on. These came from the retired artwork's own corner list, mapped
 * back onto the ground through the stretched fit it was drawn with; every one landed on a lap
 * vertex to within 4 cm, which is what makes an index the honest way to store them. Stated as
 * vertices they survive any future redraw untouched.
 */
const CORNER_VERTICES = [5, 11, 17, 27, 43, 52, 68, 77, 86, 95, 102, 112, 124, 134, 142];

/**
 * The retired artwork, for the marker migration only: its viewBox, and the extent its track
 * actually occupied.
 *
 * These are historical constants and will never change again - the drawing they describe has been
 * replaced. They are written down rather than measured from the file because this script overwrites
 * that file, so reading it back would mean reading this script's own output.
 */
const OLD_VIEW = { x: 40, y: 20, width: 760, height: 1000 };
const OLD_TRACK_BOX = { minX: 100, maxX: 678.8, minY: 100, maxY: 800 };

function chain(refs, what) {
  const points = [];
  for (const ref of refs) {
    const way = ways.get(ref);
    if (!way) throw new Error(`${what} way ${ref} is missing from the extract.`);
    if (way.tags?.oneway !== "yes") throw new Error(`${what} way ${ref} is no longer tagged oneway=yes, so its direction cannot be trusted.`);
    if (points.length && nodeKey(points.at(-1)) !== nodeKey(way.geometry[0])) {
      throw new Error(`${what} way ${ref} no longer starts where the previous one ends.`);
    }
    points.push(...(points.length ? way.geometry.slice(1) : way.geometry));
  }
  return points;
}

// Identity, checked rather than assumed: every way drawn has to sit inside PF International's own
// polygon. Fulbeck's ways are the reason this is here, and they fail it.
const venue = ways.get(VENUE_WAY);
if (venue?.tags?.name !== "PF International") throw new Error(`Way ${VENUE_WAY} is no longer the PF International venue polygon.`);
const polygon = venue.geometry.map((point) => [point.lon, point.lat]);
const inside = ([x, y]) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
for (const ref of [...LAP_WAYS, ...PIT_WAYS]) {
  const stray = ways.get(ref).geometry.filter((point) => !inside([point.lon, point.lat])).length;
  if (stray) throw new Error(`Way ${ref} has ${stray} nodes outside the PF International polygon; it may belong to another venue.`);
}

const lap = chain(LAP_WAYS, "Lap");
if (nodeKey(lap[0]) !== nodeKey(lap.at(-1))) throw new Error("The chained lap does not close.");
const pitLane = chain(PIT_WAYS, "Pit lane");

const built = layout(lap, { pitGeometry: pitLane, minTurn: 38, mergeGap: 8 });

// Where each sector starts and ends along the chained lap. Derived from the way lengths rather than
// written down, so the bands cannot drift out of step with the geometry if a way is resurveyed.
let offset = 0;
const sectorRanges = SECTORS.map((sector) => {
  const from = offset;
  for (const ref of sector.ways) offset += ways.get(ref).geometry.length - 1;
  return { label: sector.label, stroke: sector.stroke, from, to: offset };
});
if (sectorRanges.at(-1).to !== lap.length - 1) throw new Error("The sector bands do not cover the lap exactly.");

const metres = project(lap, lap[0]);
const span = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
const metreX = span(metres.map((point) => point[0]));
const metreY = span(metres.map((point) => point[1]));

const corners = CORNER_VERTICES.map((vertex, index) => {
  if (vertex < 0 || vertex >= built.canvas.length) throw new Error(`Corner ${index + 1} sits at vertex ${vertex}, which the lap no longer has.`);
  const [x, y] = built.canvas[vertex];
  return { number: index + 1, label: `T${index + 1}`, x: round4(x / VIEW.width), y: round4(y / VIEW.height) };
});
if (CORNER_VERTICES.some((vertex, index) => index && vertex <= CORNER_VERTICES[index - 1])) {
  throw new Error("The corner vertices are not in lap order, so the numbering would not follow the lap.");
}

const PROVENANCE = `The lap is five OpenStreetMap ways named Sector 1 to Sector 3, chained in their tagged oneway
direction, so the drawn lap and the clockwise direction both come from the data. It starts at the
Sector 3 to Sector 1 handover, which is the start/finish line rather than an approximation of one.

This is PF International and not Fulbeck Kart Circuit, which sits about 800 m away: every way drawn
lies inside PF International's own venue polygon, which the generator checks.

Length is the measured centreline, which runs shorter than the figure the circuit publishes.

The artwork carries no light or dark theme; see the style block.`;

writeArtwork("public/maps/pfi-international-owner-driver.svg", renderSvg({
  title: "PF International kart circuit schematic",
  description: "A schematic of the PF International kart circuit in three coloured sectors, with the start/finish line, the racing direction and a dashed pit lane, all taken from OpenStreetMap.",
  caption: `PF International - ${Math.round(built.lapMetres).toLocaleString("en-GB")} m centreline`,
  generator: `${GENERATOR} from scripts/data/pf-international-osm.json`,
  provenance: PROVENANCE,
  built,
  sectors: sectorRanges,
}));

const twiceArea = metres.slice(1).reduce((total, point, index) => total + (metres[index][0] * point[1] - point[0] * metres[index][1]), 0);
console.error(`public/maps/pfi-international-owner-driver.svg  ${Math.round(built.lapMetres)} m  ${corners.length} corners  ${twiceArea > 0 ? "Clockwise" : "Anti-clockwise"}`);
console.error(`Sectors: ${sectorRanges.map((sector) => `${sector.label} ${sector.from}-${sector.to}`).join(", ")}`);
printCorners("BUILT_IN_PFI_CORNERS", corners, GENERATOR);

// Markers the user placed are normalised to the old, stretched artwork, so they need the same
// journey the corners just took. It is linear on each axis, so four numbers carry it.
const inset = TRACK_WIDTH / 2;
const boxWidth = VIEW.width - MARGIN.left - MARGIN.right - TRACK_WIDTH;
const boxHeight = VIEW.height - MARGIN.top - MARGIN.bottom - TRACK_WIDTH;
const scale = Math.min(boxWidth / (metreX.max - metreX.min), boxHeight / (metreY.max - metreY.min));
const offsetX = MARGIN.left + inset + (boxWidth - (metreX.max - metreX.min) * scale) / 2;
const offsetY = MARGIN.top + inset + (boxHeight - (metreY.max - metreY.min) * scale) / 2;
const axis = (oldMin, oldMax, oldOrigin, oldSize, metreSpan, offset, viewSize) => {
  const perOld = (metreSpan.max - metreSpan.min) / (oldMax - oldMin);
  return [(oldSize * perOld * scale) / viewSize, (offset + (oldOrigin - oldMin) * perOld * scale) / viewSize];
};
const [ax, bx] = axis(OLD_TRACK_BOX.minX, OLD_TRACK_BOX.maxX, OLD_VIEW.x, OLD_VIEW.width, metreX, offsetX, VIEW.width);
const [ay, by] = axis(OLD_TRACK_BOX.minY, OLD_TRACK_BOX.maxY, OLD_VIEW.y, OLD_VIEW.height, metreY, offsetY, VIEW.height);
console.error(`\nMarker migration for markers placed on the retired artwork, per axis:`);
console.error(`  x' = ${ax.toFixed(6)} x + ${bx.toFixed(6)}`);
console.error(`  y' = ${ay.toFixed(6)} y + ${by.toFixed(6)}`);
const stretch = ((OLD_TRACK_BOX.maxX - OLD_TRACK_BOX.minX) / (OLD_TRACK_BOX.maxY - OLD_TRACK_BOX.minY)) / ((metreX.max - metreX.min) / (metreY.max - metreY.min));
console.error(`  (the retired drawing was ${stretch.toFixed(3)}x too wide, which is what this undoes)`);
console.error(`Published 1,382 m. Measured centreline ${Math.round(built.lapMetres)} m; pit lane ${Math.round(pathLength(project(pitLane, lap[0])))} m.`);
