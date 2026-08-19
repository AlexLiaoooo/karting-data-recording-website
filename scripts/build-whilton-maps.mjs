/**
 * Builds the built-in Whilton Mill International circuit map, and its corner list, from one
 * committed OpenStreetMap extract.
 *
 * Run: node scripts/build-whilton-maps.mjs
 * Writes public/maps/whilton-mill-international.svg and prints the TrackCorner[] literal for
 * lib/track-map/built-in-maps.ts.
 *
 * The extract still holds the National (16338536) and Indy (16338537) relations, which chain the
 * same way, so adding either back is one more entry in CIRCUITS. The Mill cadet circuit is a
 * single closed way rather than a relation and would also need a lap start chosen for it, since
 * a closed way begins wherever the surveyor started rather than at the line.
 *
 * This differs from scripts/derive-corners.mjs, which reads corners back out of artwork it did
 * not draw. Here one pass owns both, so the labels cannot drift from the map they sit on.
 *
 * The source is scripts/data/whilton-mill-osm.json rather than a live Overpass call, so the
 * artwork is reproducible without a network and a change to it shows up as a diff.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OSM = JSON.parse(readFileSync("scripts/data/whilton-mill-osm.json", "utf8"));
const ways = new Map(OSM.elements.filter((element) => element.type === "way").map((way) => [way.id, way]));
const relations = new Map(OSM.elements.filter((element) => element.type === "relation").map((rel) => [rel.id, rel]));

/** The way carrying the pit lane past the main complex; drawn separately, never part of a lap. */
const MAIN_PIT_LANE = 1208334015;

const CIRCUITS = [
  { key: "whilton-mill-international", file: "whilton-mill-international", name: "International", relation: 16338535, pitLane: MAIN_PIT_LANE },
];

// Canvas. Portrait, because the circuit is taller than it is wide once projected north-up, and
// the map is width-constrained on a phone.
const VIEW = { x: 0, y: 0, width: 760, height: 1000 };
const MARGIN = { top: 120, right: 60, bottom: 150, left: 60 };
const TRACK_WIDTH = 22;

// Degrees. A vertex group turning less than this reads as part of a straight. Matched to the
// threshold scripts/derive-corners.mjs settled on for PF International, so the two built-in
// tracks label corners at the same level of detail.
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 55);
const VERTEX_TURN_FLOOR = 6; // degrees; below this is survey noise on a straight
// Metres; bridges a brief straight inside one long corner. 8 sits mid-plateau: this circuit
// yields the same eleven corners at every value from 6 to 14, so the threshold is not perched
// on an edge.
const MERGE_GAP = Number(process.env.MERGE_GAP ?? 8);

/**
 * Degrees. A single corner tops out at a hairpin, so a continuous sweep past this is two corners
 * a driver would name separately and gets split into equal-turn parts. This circuit has no such
 * sweep — its sharpest group turns 141 degrees — but the guard stays because a sweep that long
 * has no straight inside it for MERGE_GAP to break at, so nothing else would catch one.
 */
const MAX_CORNER_TURN = 180;

const nodeKey = (point) => `${point.lat.toFixed(7)},${point.lon.toFixed(7)}`;


/**
 * Chains a relation's ways into one lap-ordered loop. Every Whilton Mill raceway way is tagged
 * oneway=yes, so way direction is racing direction and the chain never needs a segment
 * reversed — if a join fails it means the data changed, and guessing would silently produce a
 * lap that runs backwards through part of the circuit.
 */
function chainWays(refs, startName) {
  const pool = new Map(refs.map((ref) => [ref, ways.get(ref)]));
  for (const [ref, way] of pool) if (!way) throw new Error(`Way ${ref} is missing from the extract.`);

  const start = refs.find((ref) => pool.get(ref).tags?.name === startName) ?? refs[0];
  const chain = [start];
  const loop = [...pool.get(start).geometry];
  pool.delete(start);

  while (pool.size) {
    const tail = nodeKey(loop.at(-1));
    let next;
    for (const [ref, way] of pool) if (nodeKey(way.geometry[0]) === tail) { next = ref; break; }
    if (next === undefined) {
      throw new Error(`Could not continue the lap after way ${chain.at(-1)}; ${pool.size} ways left unjoined.`);
    }
    chain.push(next);
    loop.push(...pool.get(next).geometry.slice(1));
    pool.delete(next);
  }

  if (nodeKey(loop[0]) !== nodeKey(loop.at(-1))) throw new Error("The chained lap does not close.");
  return { chain, loop };
}

/** Equirectangular projection to metres about a local origin. Fine over 250 m; y grows south to match SVG. */
function project(points, origin) {
  const scale = Math.cos((origin.lat * Math.PI) / 180) * 111320;
  return points.map((point) => [(point.lon - origin.lon) * scale, -(point.lat - origin.lat) * 110540]);
}

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const pathLength = (points) => points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);

/** Signed turn in degrees at a vertex: positive is one hand, negative the other. */
function turnAt(points, index) {
  const [px, py] = points[index - 1];
  const [cx, cy] = points[index];
  const [nx, ny] = points[index + 1];
  const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx);
  const dot = (cx - px) * (nx - cx) + (cy - py) * (ny - cy);
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

/**
 * Groups consecutive turning vertices into corners and returns the apex of each, in lap order.
 * The apex is the vertex at half the group's cumulative turn, which is close enough for a label.
 */
function findCorners(loop) {
  const groups = [];
  let current = null;
  for (let index = 1; index < loop.length - 1; index += 1) {
    const turn = turnAt(loop, index);
    if (Math.abs(turn) < VERTEX_TURN_FLOOR) continue;
    const gap = current ? distance(loop[current.end], loop[index]) : Infinity;
    if (current && gap < MERGE_GAP && Math.sign(turn) === Math.sign(current.total)) {
      current.end = index;
      current.total += turn;
      current.turns.push([index, turn]);
    } else {
      if (current) groups.push(current);
      current = { start: index, end: index, total: turn, turns: [[index, turn]] };
    }
  }
  if (current) groups.push(current);

  return groups
    .filter((group) => Math.abs(group.total) >= MIN_CORNER_TURN)
    .flatMap((group) => {
      const sweep = Math.abs(group.total);
      const parts = Math.ceil(sweep / MAX_CORNER_TURN);
      // The apex of each part is the vertex at the midpoint of that part's share of the sweep.
      return Array.from({ length: parts }, (_, part) => {
        const mark = (sweep * (part + 0.5)) / parts;
        let running = 0;
        const apex = group.turns.find(([, turn]) => (running += Math.abs(turn)) >= mark) ?? group.turns.at(-1);
        return { index: apex[0], point: loop[apex[0]], turn: Math.round(group.total / parts) };
      });
    });
}

const round1 = (value) => Number(value.toFixed(1));
const round4 = (value) => Number(value.toFixed(4));
const toPath = (points) => `M ${points.map(([x, y]) => `${round1(x)},${round1(y)}`).join(" L ")}`;

function build(circuit) {
  const relation = relations.get(circuit.relation);
  if (!relation) throw new Error(`Relation ${circuit.relation} is missing from the extract.`);
  const refs = relation.members
    .filter((member) => member.type === "way" && member.ref !== circuit.pitLane)
    .map((member) => member.ref);
  const { chain, loop } = chainWays(refs, "Home Straight");

  const pitWay = ways.get(circuit.pitLane);
  if (!pitWay) throw new Error(`Pit lane way ${circuit.pitLane} is missing from the extract.`);

  const origin = loop[0];
  const metres = project(loop, origin);
  const pitMetres = project(pitWay.geometry, origin);
  const lapMetres = pathLength(metres);

  // Frame the circuit alone; the pit lane may run outside it and must not shrink the track.
  const inset = TRACK_WIDTH / 2;
  const xs = metres.map(([x]) => x);
  const ys = metres.map(([, y]) => y);
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const boxWidth = VIEW.width - MARGIN.left - MARGIN.right - TRACK_WIDTH;
  const boxHeight = VIEW.height - MARGIN.top - MARGIN.bottom - TRACK_WIDTH;
  const scale = Math.min(boxWidth / (bounds.maxX - bounds.minX), boxHeight / (bounds.maxY - bounds.minY));
  const offsetX = MARGIN.left + inset + (boxWidth - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = MARGIN.top + inset + (boxHeight - (bounds.maxY - bounds.minY) * scale) / 2;
  const toCanvas = ([x, y]) => [offsetX + (x - bounds.minX) * scale, offsetY + (y - bounds.minY) * scale];

  const corners = findCorners(metres).map((corner, index) => {
    const [x, y] = toCanvas(corner.point);
    return { number: index + 1, label: `T${index + 1}`, x: round4(x / VIEW.width), y: round4(y / VIEW.height), turn: corner.turn };
  });

  return {
    circuit,
    chain,
    lapMetres,
    corners,
    canvas: loop.map((_, index) => toCanvas(metres[index])),
    pitCanvas: pitMetres.map(toCanvas),
    startTick: startFinishTick(metres.map(toCanvas)),
  };
}

/**
 * Walks a fixed distance along the loop and returns the point there. Stepping by vertex index
 * instead would land somewhere different on every circuit: a straight is two vertices tens of
 * metres apart while a hairpin packs a dozen into a few metres.
 */
function pointAlong(points, target) {
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const step = distance(points[index - 1], points[index]);
    if (travelled + step >= target) {
      const fraction = step === 0 ? 0 : (target - travelled) / step;
      return [
        points[index - 1][0] + (points[index][0] - points[index - 1][0]) * fraction,
        points[index - 1][1] + (points[index][1] - points[index - 1][1]) * fraction,
      ];
    }
    travelled += step;
  }
  return points.at(-1);
}

/** A line across the track at the lap start, plus an arrowhead further along showing which way the lap runs. */
function startFinishTick(canvasLoop) {
  const [x, y] = canvasLoop[0];
  // Both offsets are in canvas units so they stay visually identical across circuits, which are
  // drawn at slightly different scales.
  const angle = (() => {
    const [ax, ay] = pointAlong(canvasLoop, 26);
    return Math.atan2(ay - y, ax - x);
  })();
  const half = TRACK_WIDTH / 2 + 7;
  const nx = Math.cos(angle + Math.PI / 2) * half;
  const ny = Math.sin(angle + Math.PI / 2) * half;

  // The arrow sits clear of the tick so the two do not read as one shape, and takes its own
  // heading so it still points along the track if the lap starts into a bend.
  const [ax, ay] = pointAlong(canvasLoop, 62);
  const [bx, by] = pointAlong(canvasLoop, 76);
  const heading = Math.atan2(by - ay, bx - ax);
  const tip = 15;
  const wing = 10;
  const arrow = [
    [ax + Math.cos(heading) * tip, ay + Math.sin(heading) * tip],
    [ax + Math.cos(heading + 2.5) * wing, ay + Math.sin(heading + 2.5) * wing],
    [ax + Math.cos(heading - 2.5) * wing, ay + Math.sin(heading - 2.5) * wing],
  ];
  return {
    line: [round1(x + nx), round1(y + ny), round1(x - nx), round1(y - ny)],
    arrow: arrow.map(([px, py]) => `${round1(px)},${round1(py)}`).join(" "),
  };
}

function toSvg(built) {
  const { circuit, lapMetres, canvas, pitCanvas, startTick } = built;
  const title = `Whilton Mill ${circuit.name} Circuit`;
  const caption = `${circuit.name} Circuit · ${Math.round(lapMetres).toLocaleString("en-GB")} m centreline`;

  return `<!--
  Generated by scripts/build-whilton-maps.mjs from scripts/data/whilton-mill-osm.json.
  Do not hand-edit: re-run the script instead, and re-paste the corner list it prints.

  The lap is chained from OpenStreetMap raceway ways in their tagged oneway direction, so the
  start/finish tick and arrow show the real racing direction rather than a drawing convention.
  Length is the measured centreline, which is shorter than the figure an operator publishes for
  the same circuit; it is labelled "centreline" rather than presented as the official distance.
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}" role="img" aria-labelledby="title desc">
  <title id="title">${title} schematic</title>
  <desc id="desc">A schematic of the ${circuit.name} circuit at Whilton Mill, with the start/finish line, the racing direction and a dashed pit lane.</desc>
  <style>
    /* An SVG shown through &lt;img&gt; is its own document and cannot see the app's light/dark
       toggle, so it follows the device colour scheme instead. Only surfaces and text swap;
       the track colour reads on either background. */
    .map-bg { fill: #f7f8fb; }
    .map-caption { fill: #64748b; }
    .map-legend-surface { fill: #ffffff; stroke: #e2e8f0; }
    .map-legend-label { fill: #334155; }
    .map-shadow { stroke: #172033; }
    .map-mark { fill: #334155; stroke: #334155; }
    @media (prefers-color-scheme: dark) {
      .map-bg { fill: #131c29; }
      .map-caption { fill: #93a4bb; }
      .map-legend-surface { fill: #1c2735; stroke: #30405a; }
      .map-legend-label { fill: #ccd8e6; }
      .map-shadow { stroke: #05080d; }
      .map-mark { fill: #ccd8e6; stroke: #ccd8e6; }
    }
  </style>
  <rect class="map-bg" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.width}" height="${VIEW.height}" rx="36"/>
  <!-- The circuit name is deliberately absent: the app shows it in the top bar and as the page
       heading, so repeating it here put three copies on one screen. -->
  <text class="map-caption" x="60" y="76" font-family="Arial, Helvetica, sans-serif" font-size="20">${caption}</text>

  <g class="map-shadow" fill="none" stroke-width="${TRACK_WIDTH + 12}" stroke-linecap="round" stroke-linejoin="round" opacity="0.14">
    <path d="${toPath(canvas)}"/>
  </g>

  <!-- Pit lane, intentionally shown separately from the circuit loop. -->
  <path d="${toPath(pitCanvas)}" fill="none" stroke="#94a3b8" stroke-width="10" stroke-dasharray="18 14" stroke-linecap="round"/>

  <path d="${toPath(canvas)}" fill="none" stroke="#3b82f6" stroke-width="${TRACK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Start/finish, and the racing direction taken from the ways' oneway tagging. -->
  <line class="map-mark" x1="${startTick.line[0]}" y1="${startTick.line[1]}" x2="${startTick.line[2]}" y2="${startTick.line[3]}" stroke-width="6" stroke-linecap="round"/>
  <polygon class="map-mark" points="${startTick.arrow}" stroke-width="1"/>

  <g font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">
    <g transform="translate(60 ${VIEW.height - 130})"><rect class="map-legend-surface" width="290" height="86" rx="16"/><line x1="22" y1="28" x2="38" y2="28" stroke="#3b82f6" stroke-width="8" stroke-linecap="round"/><text class="map-legend-label" x="52" y="35">Circuit</text><line x1="176" y1="28" x2="192" y2="28" stroke="#94a3b8" stroke-width="6" stroke-dasharray="5 4"/><text class="map-legend-label" x="206" y="35">Pit lane</text><line class="map-mark" x1="30" y1="50" x2="30" y2="66" stroke-width="5" stroke-linecap="round"/><text class="map-legend-label" x="52" y="65">Start</text><polygon class="map-mark" points="176,58 192,64 176,70"/><text class="map-legend-label" x="206" y="65">Direction</text></g>
  </g>

  <text class="map-caption" x="60" y="${VIEW.height - 22}" font-family="Arial, Helvetica, sans-serif" font-size="13">Schematic generated from OpenStreetMap raceway geometry · © OpenStreetMap contributors · ODbL 1.0</text>
</svg>
`;
}

const built = CIRCUITS.map(build);

for (const item of built) {
  const path = `public/maps/${item.circuit.file}.svg`;
  writeFileSync(path, toSvg(item));
  console.error(`${path}  ${Math.round(item.lapMetres)} m  ${item.chain.length} ways  ${item.corners.length} corners`);
}

console.log("// Generated by scripts/build-whilton-maps.mjs. Do not hand-edit; re-run the script.");
for (const item of built) {
  const constant = `BUILT_IN_${item.circuit.key.replace(/-/g, "_").toUpperCase()}_CORNERS`;
  console.log(`\nexport const ${constant}: TrackCorner[] = [`);
  for (const corner of item.corners) {
    console.log(`  { number: ${corner.number}, label: "${corner.label}", x: ${corner.x}, y: ${corner.y} },`);
  }
  console.log("];");
}

console.error("\nCorner turn angles (degrees, sign is turn direction):");
for (const item of built) {
  console.error(`  ${item.circuit.name.padEnd(14)} ${item.corners.map((corner) => `${corner.label}:${corner.turn}`).join("  ")}`);
}
