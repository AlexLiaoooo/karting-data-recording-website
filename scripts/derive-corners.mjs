/**
 * Derives corner positions for the built-in PF International map from its own path geometry,
 * so the corner list cannot drift away from the artwork it labels.
 *
 * Run: node scripts/derive-corners.mjs
 * Prints a TrackCorner[] literal to paste into lib/track-map/built-in-map.ts.
 *
 * Method: chain the three sector paths into one lap-ordered loop, measure the turn angle at
 * each vertex, then group consecutive turning vertices into corners. A group counts as a
 * corner when it turns more than MIN_CORNER_TURN in total; its position is the vertex at the
 * halfway point of that turn, which is close enough to the apex for a reference label.
 */
import { readFileSync } from "node:fs";

const SVG = "public/maps/pfi-international-owner-driver.svg";

/**
 * Corners identified by hand, as normalised positions on the map. Curvature detection only
 * finds bends sharp enough to stand out; a circuit also names long sweeping sections that
 * never exceed the threshold. These are snapped onto the track centreline and merged into
 * the lap order with the detected ones, so hand-placed and derived corners number as one
 * continuous sequence.
 */
const MANUAL_CORNERS = [
  { x: 0.413, y: 0.577 },
  { x: 0.286, y: 0.594 },
  { x: 0.210, y: 0.682 },
];

/**
 * Proper names, keyed by the resulting corner number. A named complex can span more than one
 * corner, as the Fullerton Esses does. Keyed by number rather than position because the
 * numbering is the thing the owner works from; if corners are added or removed, re-check
 * these against the printed list this script emits.
 */
const CORNER_NAMES = {
  9: "Fullerton Esses",
  10: "Fullerton Esses",
  11: "Bobby Game Corner",
  12: "Fletcher's Loop",
};
// Degrees; below this a bend reads as part of a straight. Set to include every bend the
// owner counts as a corner, which is more than PF International's own circuit guide names —
// that guide's numbering is deliberately not used here.
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 55);
const VERTEX_TURN_FLOOR = 6; // degrees; ignore surveying noise between straight segments
const MERGE_GAP = 34; // user units; bridge a brief straight inside one long corner

const markup = readFileSync(SVG, "utf8");

// The coloured sector paths carry an explicit stroke; the shadow layer and pit lane do not.
const coloured = [...markup.matchAll(/<path d="([^"]+)"\s+stroke="(#[0-9a-f]{6})" stroke-width="22"/g)]
  .map(([, d, stroke]) => ({ stroke, points: parsePoints(d) }));

function parsePoints(d) {
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]);
}

const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;

// The loop is closed, so every path starts where another ends and there is no natural first
// path. The lap starts at start/finish, which is where Sector 1 (blue) takes over from
// Sector 3 (green) — so begin at the blue path whose start is a green path's end.
const SECTOR_1 = "#3b82f6";
const SECTOR_3 = "#22c55e";
const remaining = [...coloured];
const startIndex = remaining.findIndex((path) =>
  path.stroke === SECTOR_1 && remaining.some((other) => other.stroke === SECTOR_3 && same(other.points.at(-1), path.points[0])));
if (startIndex === -1) throw new Error("Could not find the Sector 3 to Sector 1 transition; check the stroke colours.");
const ordered = [remaining.splice(startIndex, 1)[0]];

while (remaining.length) {
  const tail = ordered.at(-1).points.at(-1);
  const nextIndex = remaining.findIndex((path) => same(path.points[0], tail));
  if (nextIndex === -1) break;
  ordered.push(remaining.splice(nextIndex, 1)[0]);
}

// One continuous loop, dropping the duplicated joint vertices.
const loop = ordered.flatMap((path, index) => (index === 0 ? path.points : path.points.slice(1)));

const turnAt = (index) => {
  const [px, py] = loop[index - 1];
  const [cx, cy] = loop[index];
  const [nx, ny] = loop[index + 1];
  const cross = (cx - px) * (ny - cy) - (cy - py) * (nx - cx);
  const dot = (cx - px) * (nx - cx) + (cy - py) * (ny - cy);
  return (Math.atan2(cross, dot) * 180) / Math.PI;
};

const groups = [];
let current = null;
for (let index = 1; index < loop.length - 1; index += 1) {
  const turn = turnAt(index);
  if (Math.abs(turn) < VERTEX_TURN_FLOOR) continue;

  const gap = current ? Math.hypot(loop[index][0] - loop[current.end][0], loop[index][1] - loop[current.end][1]) : Infinity;
  const sameDirection = current && Math.sign(turn) === Math.sign(current.total);
  if (current && gap < MERGE_GAP && sameDirection) {
    current.end = index;
    current.total += turn;
    current.turns.push([index, turn]);
  } else {
    if (current) groups.push(current);
    current = { start: index, end: index, total: turn, turns: [[index, turn]] };
  }
}
if (current) groups.push(current);

const viewBox = markup.match(/viewBox="\s*([\d.-]+)\s+([\d.-]+)\s+([\d.]+)\s+([\d.]+)/).slice(1).map(Number);
const [vx, vy, vw, vh] = viewBox;
const round = (value) => Number(value.toFixed(4));

const detected = groups
  .filter((group) => Math.abs(group.total) >= MIN_CORNER_TURN)
  .map((group) => {
    // Vertex at half of the group's cumulative turn — the apex for labelling purposes.
    let running = 0;
    const half = Math.abs(group.total) / 2;
    const apex = group.turns.find(([, turn]) => (running += Math.abs(turn)) >= half) ?? group.turns[0];
    return { index: apex[0], point: loop[apex[0]], source: "derived" };
  });

// Snap each hand-placed corner onto the nearest loop vertex, which also gives it a position
// in the lap so it can be sorted alongside the detected ones.
const manual = MANUAL_CORNERS.map((corner) => {
  const target = [vx + corner.x * vw, vy + corner.y * vh];
  let bestIndex = 0;
  let bestDistance = Infinity;
  loop.forEach((point, index) => {
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1]);
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
  });
  return { index: bestIndex, point: loop[bestIndex], source: "manual", snap: Math.round(bestDistance) };
});

const corners = [...detected, ...manual].sort((a, b) => a.index - b.index);

const literal = corners.map((corner, index) => {
  const number = index + 1;
  const x = round((corner.point[0] - vx) / vw);
  const y = round((corner.point[1] - vy) / vh);
  const name = CORNER_NAMES[number];
  const named = name ? ` name: ${JSON.stringify(name)},` : "";
  return `  { number: ${number}, label: "T${number}",${named} x: ${x}, y: ${y} },`;
});

console.log(`// Derived by scripts/derive-corners.mjs from ${SVG}. Do not hand-edit.`);
console.log(`// ${corners.length} corners in lap order: ${detected.length} from curvature, ${manual.length} placed by hand.`);
console.log("export const BUILT_IN_PFI_CORNERS: TrackCorner[] = [");
console.log(literal.join("\n"));
console.log("];");
console.error("");
corners.forEach((corner, index) => {
  const detail = corner.source === "manual" ? `hand-placed, snapped ${corner.snap} units onto the track` : "from curvature";
  console.error(`  T${String(index + 1).padEnd(3)} ${detail}`);
});
