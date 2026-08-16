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
const MIN_CORNER_TURN = 55; // degrees; below this a bend reads as part of a straight
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

const corners = groups
  .filter((group) => Math.abs(group.total) >= MIN_CORNER_TURN)
  .map((group) => {
    // Vertex at half of the group's cumulative turn — the apex for labelling purposes.
    let running = 0;
    const half = Math.abs(group.total) / 2;
    const apex = group.turns.find(([, turn]) => (running += Math.abs(turn)) >= half) ?? group.turns[0];
    return { index: apex[0], point: loop[apex[0]], total: Math.round(group.total) };
  });

const viewBox = markup.match(/viewBox="\s*([\d.-]+)\s+([\d.-]+)\s+([\d.]+)\s+([\d.]+)/).slice(1).map(Number);
const [vx, vy, vw, vh] = viewBox;
const round = (value) => Number(value.toFixed(4));

const literal = corners.map((corner, index) => {
  const label = `T${index + 1}`;
  const x = round((corner.point[0] - vx) / vw);
  const y = round((corner.point[1] - vy) / vh);
  return `  { number: ${index + 1}, label: "${label}", x: ${x}, y: ${y} },`;
});

console.log(`// Derived by scripts/derive-corners.mjs from ${SVG}. Do not hand-edit.`);
console.log(`// ${corners.length} corners, lap order from the Sector 1 start.`);
console.log("export const BUILT_IN_PFI_CORNERS: TrackCorner[] = [");
console.log(literal.join("\n"));
console.log("];");
console.error(`\nturn totals (deg): ${corners.map((corner) => corner.total).join(", ")}`);
