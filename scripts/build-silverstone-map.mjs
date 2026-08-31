/**
 * Builds the built-in Kart Silverstone Grand Prix circuit map, and its corner list, from one
 * committed OpenStreetMap extract.
 *
 * Run: node scripts/build-silverstone-map.mjs
 * Writes public/maps/silverstone-grand-prix.svg and prints the TrackCorner[] literal for
 * lib/track-map/built-in-maps.ts.
 *
 * Run with LAP=print to list the closed laps the network contains, with the edge signature of
 * each, which is how LAP_EDGES below was chosen.
 *
 * WHY THIS IS NOT LIKE scripts/build-whilton-maps.mjs
 *
 * Whilton Mill is mapped with type=circuit relations and oneway tagging, so both the lap and the
 * direction fall out of the data. Kart Silverstone has neither: eleven raceway ways form one
 * connected network with infield cut-throughs, and the network contains 154 distinct closed laps.
 * Nothing in OpenStreetMap says which of them is a circuit, or which way round any of them runs.
 *
 * So the lap is pinned by hand below rather than derived. The direction is not in the data either,
 * and is supplied by the owner, who drives there: the circuit runs anti-clockwise, which is what
 * ANTI_CLOCKWISE below orients the ring to. That fixes the order the corners are numbered in.
 *
 * A start line is still not known — there is no pit lane in the extract and nothing marks one — so
 * none is drawn, and the lap has to begin at an arbitrary point. The corner numbers are therefore
 * in the right order but do not necessarily begin where the circuit counts Turn 1.
 */
import { readFileSync } from "node:fs";
import { layout, nodeKey, printCorners, project, renderSvg, writeArtwork } from "./lib/circuit-map.mjs";

const GENERATOR = "scripts/build-silverstone-map.mjs";
const OSM = JSON.parse(readFileSync("scripts/data/silverstone-osm.json", "utf8"));
const ways = OSM.elements.filter((element) => element.type === "way");

/**
 * The lap drawn, as the edges of the network it uses.
 *
 * Chosen as the closed lap whose measured centreline is nearest the 1,377 m the circuit publishes
 * for its Grand Prix layout, and which scored highest when every candidate was aligned against the
 * operator's own layout diagram. That margin was narrow — six candidates sit within 2% of 1,377 m
 * and the best beat the runner-up by 2 IoU points — so this is the best available reconstruction
 * rather than a confirmed match, and it is labelled as such in the app.
 */
const LAP_EDGES = [
  "1430385979:0-4",
  "1430385980:0-4",
  "1526452829:0-3",
  "1526452829:3-25",
  "1526452830:12-14",
  "1526452831:0-12",
  "1526452831:12-19",
  "1526452832:0-3",
  "1526452832:19-22",
  "1526452832:3-7",
  "1526452832:9-19",
  "1526452833:0-2",
  "1526452835:0-1",
  "1526452835:10-15",
  "1526452836:0-5",
  "1526452844:0-4",
];

// Degrees; a vertex group turning less than this reads as part of a straight. Matched to the 38
// that Whilton Mill settled on, so the two OpenStreetMap-derived circuits label corners at the
// same level of detail. The operator counts 18 corners on this layout; the detector finds fewer,
// which is one more reason the numbering here is the app's own rather than the circuit's.
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 38);
const MERGE_GAP = Number(process.env.MERGE_GAP ?? 8);

/** Splits every way at the points where another way touches it, giving the network's edges. */
function buildEdges() {
  const touches = new Map();
  for (const way of ways) {
    for (const point of way.geometry) {
      const key = nodeKey(point);
      if (!touches.has(key)) touches.set(key, new Set());
      touches.get(key).add(way.id);
    }
  }

  const edges = [];
  for (const way of ways) {
    let startIndex = 0;
    for (let index = 1; index < way.geometry.length; index += 1) {
      const isJunction = touches.get(nodeKey(way.geometry[index])).size > 1;
      if (!isJunction && index !== way.geometry.length - 1) continue;
      const points = way.geometry.slice(startIndex, index + 1);
      if (points.length > 1) edges.push({ key: `${way.id}:${startIndex}-${index}`, from: nodeKey(points[0]), to: nodeKey(points.at(-1)), points });
      startIndex = index;
    }
  }
  return edges;
}

const metresBetween = (a, b) => {
  const scale = Math.cos((a.lat * Math.PI) / 180) * 111320;
  return Math.hypot((b.lon - a.lon) * scale, (b.lat - a.lat) * 110540);
};
const edgeMetres = (edge) => edge.points.slice(1).reduce((total, point, index) => total + metresBetween(edge.points[index], point), 0);

const edges = buildEdges().filter((edge) => edgeMetres(edge) > 1);

if (process.env.LAP === "print") {
  const byNode = new Map();
  for (const edge of edges) {
    if (!byNode.has(edge.from)) byNode.set(edge.from, []);
    if (!byNode.has(edge.to)) byNode.set(edge.to, []);
    byNode.get(edge.from).push(edge);
    byNode.get(edge.to).push(edge);
  }
  const seen = new Set();
  const laps = [];
  const walk = (start, current, used, visited, length) => {
    for (const edge of byNode.get(current)) {
      if (used.has(edge)) continue;
      const next = edge.from === current ? edge.to : edge.from;
      if (next === start && used.size >= 2) {
        const signature = [...used, edge].map((e) => e.key).sort().join(",");
        if (!seen.has(signature)) { seen.add(signature); laps.push({ length: length + edgeMetres(edge), signature }); }
        continue;
      }
      if (visited.has(next)) continue;
      used.add(edge); visited.add(next);
      walk(start, next, used, visited, length + edgeMetres(edge));
      used.delete(edge); visited.delete(next);
    }
  };
  for (const node of byNode.keys()) walk(node, node, new Set(), new Set([node]), 0);
  laps.sort((a, b) => Math.abs(a.length - 1377) - Math.abs(b.length - 1377));
  console.log(`${laps.length} closed laps; closest to the published 1,377 m first:\n`);
  for (const lap of laps.slice(0, 8)) console.log(`${lap.length.toFixed(0).padStart(5)} m  [${lap.signature.split(",").map((k) => `"${k}"`).join(", ")}]`);
  process.exit(0);
}

/** Chains the pinned edges into one ordered ring, failing loudly if they no longer form a lap. */
function ringFromPinnedEdges() {
  const byKey = new Map(edges.map((edge) => [edge.key, edge]));
  const pool = LAP_EDGES.map((key) => {
    const edge = byKey.get(key);
    if (!edge) throw new Error(`Edge ${key} is not in the extract; the source data changed. Re-run with LAP=print.`);
    return edge;
  });

  const first = pool.shift();
  const points = [...first.points];
  let tail = first.to;
  while (pool.length) {
    const index = pool.findIndex((edge) => edge.from === tail || edge.to === tail);
    if (index === -1) throw new Error(`The pinned edges do not chain into a lap; ${pool.length} left unjoined.`);
    const [edge] = pool.splice(index, 1);
    const forwards = edge.from === tail;
    points.push(...(forwards ? edge.points : [...edge.points].reverse()).slice(1));
    tail = forwards ? edge.to : edge.from;
  }
  if (nodeKey(points[0]) !== nodeKey(points.at(-1))) throw new Error("The pinned lap does not close.");
  return points;
}

/**
 * Rotates the ring to start at its northernmost point.
 *
 * Nothing in the source marks a start line, so this is an explicit drawing convention rather than
 * a claim about the circuit. It only has to be deterministic, so the numbering does not move when
 * the script is re-run.
 */
function rotateToNorthernmost(ring) {
  const open = ring.slice(0, -1);
  let best = 0;
  open.forEach((point, index) => { if (point.lat > open[best].lat) best = index; });
  const rotated = [...open.slice(best), ...open.slice(0, best)];
  return [...rotated, rotated[0]];
}

/**
 * Orients the ring anti-clockwise, which is the way the circuit runs.
 *
 * Chaining the pinned edges gives a ring in whichever order they happened to join, so its
 * direction is arbitrary until it is set. The shoelace sum is taken in projected coordinates,
 * where y grows south as it does on the canvas: a positive sum there means the ring is traversed
 * clockwise, so it gets reversed.
 */
function orientAntiClockwise(ring) {
  const metres = project(ring, ring[0]);
  const twiceArea = metres.slice(1).reduce((total, point, index) => total + (metres[index][0] * point[1] - point[0] * metres[index][1]), 0);
  return twiceArea > 0 ? [...ring].reverse() : ring;
}

const ring = rotateToNorthernmost(orientAntiClockwise(ringFromPinnedEdges()));
// The direction is known and drawn; the start line is not known and is not.
const built = layout(ring, { minTurn: MIN_CORNER_TURN, mergeGap: MERGE_GAP, withArrow: true, withStartTick: false });

const PROVENANCE = `Kart Silverstone is mapped as a connected network of raceway ways with no type=circuit relation
and no oneway tagging, so the lap does not come from OpenStreetMap. The lap drawn here is pinned by
hand in the generator: it is the closed lap closest to the 1,377 m the circuit publishes for its
Grand Prix layout, and the best match against the operator's own diagram, but it is a
reconstruction rather than a confirmed layout.

The anti-clockwise direction is not from the source either; it was supplied by the owner, who
drives there. No start/finish line is drawn, because nothing records one: the corner numbers run in
the right order but do not necessarily begin where the circuit counts Turn 1.

Length is the measured centreline. The artwork carries no light or dark theme; see the style block.`;

writeArtwork("public/maps/silverstone-grand-prix.svg", renderSvg({
  title: "Kart Silverstone Grand Prix circuit schematic",
  description: "A schematic of the Grand Prix circuit at Kart Silverstone, reconstructed from OpenStreetMap geometry, with an arrow showing the anti-clockwise racing direction. No start line is shown, because the source records none.",
  caption: `Grand Prix Circuit · ${Math.round(built.lapMetres).toLocaleString("en-GB")} m centreline`,
  generator: `${GENERATOR} from scripts/data/silverstone-osm.json`,
  provenance: PROVENANCE,
  built,
}));

console.error(`public/maps/silverstone-grand-prix.svg  ${Math.round(built.lapMetres)} m  ${LAP_EDGES.length} edges  ${built.corners.length} corners`);
printCorners("BUILT_IN_SILVERSTONE_GRAND_PRIX_CORNERS", built.corners, GENERATOR);
console.error(`\nCorner turn angles (degrees, sign is turn direction):\n  ${built.corners.map((corner) => `${corner.label}:${corner.turn}`).join("  ")}`);
console.error(`\nPublished Grand Prix layout: 1,377 m, 18 corners. Measured centreline: ${Math.round(built.lapMetres)} m, ${built.corners.length} corners detected.`);

