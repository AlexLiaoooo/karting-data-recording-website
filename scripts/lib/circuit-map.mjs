/**
 * The geometry, corner detection and drawing shared by the circuit map generators.
 *
 * Each generator owns only the part that differs: how a lap is recovered from its OpenStreetMap
 * extract. Whilton Mill has type=circuit relations and oneway tagging, so its lap and direction
 * come straight from the data; Kart Silverstone has neither and its lap has to be pinned by hand.
 * Everything after "here is an ordered ring of points" is the same, and lives here so the corner
 * algorithm — which decides how the circuit is numbered — cannot drift into two versions.
 */

/** Canvas. Portrait, because a kart circuit projected north-up is usually taller than it is wide,
 *  and the map is width-constrained on a phone. */
export const VIEW = { x: 0, y: 0, width: 760, height: 1000 };
export const MARGIN = { top: 120, right: 60, bottom: 150, left: 60 };
export const TRACK_WIDTH = 22;

export const VERTEX_TURN_FLOOR = 6; // degrees; below this is survey noise on a straight

/**
 * Degrees. A single corner tops out at a hairpin, so a continuous sweep past this is two corners a
 * driver would name separately and gets split into equal-turn parts. A sweep that long has no
 * straight inside it for the merge gap to break at, so nothing else would catch one.
 */
export const MAX_CORNER_TURN = 180;

export const nodeKey = (point) => `${point.lat.toFixed(7)},${point.lon.toFixed(7)}`;

/** Equirectangular projection to metres about a local origin. Fine over a few hundred metres;
 *  y grows south to match SVG. */
export function project(points, origin) {
  const scale = Math.cos((origin.lat * Math.PI) / 180) * 111320;
  return points.map((point) => [(point.lon - origin.lon) * scale, -(point.lat - origin.lat) * 110540]);
}

export const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const pathLength = (points) => points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);

export const round1 = (value) => Number(value.toFixed(1));
export const round4 = (value) => Number(value.toFixed(4));
export const toPath = (points) => `M ${points.map(([x, y]) => `${round1(x)},${round1(y)}`).join(" L ")}`;

/** Signed turn in degrees at a vertex: positive is one hand, negative the other. */
export function turnAt(points, index) {
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
 *
 * `minTurn` and `mergeGap` are passed in rather than fixed: the threshold encodes a judgement
 * about what counts as a corner on a particular circuit, and two circuits do not answer that the
 * same way.
 */
export function findCorners(loop, { minTurn, mergeGap }) {
  const groups = [];
  let current = null;
  for (let index = 1; index < loop.length - 1; index += 1) {
    const turn = turnAt(loop, index);
    if (Math.abs(turn) < VERTEX_TURN_FLOOR) continue;
    const gap = current ? distance(loop[current.end], loop[index]) : Infinity;
    if (current && gap < mergeGap && Math.sign(turn) === Math.sign(current.total)) {
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
    .filter((group) => Math.abs(group.total) >= minTurn)
    .flatMap((group) => {
      const sweep = Math.abs(group.total);
      const parts = Math.ceil(sweep / MAX_CORNER_TURN);
      return Array.from({ length: parts }, (_, part) => {
        const mark = (sweep * (part + 0.5)) / parts;
        let running = 0;
        const apex = group.turns.find(([, turn]) => (running += Math.abs(turn)) >= mark) ?? group.turns.at(-1);
        return { index: apex[0], point: loop[apex[0]], turn: Math.round(group.total / parts) };
      });
    });
}

/**
 * Walks a fixed distance along the loop and returns the point there. Stepping by vertex index
 * instead would land somewhere different on every circuit: a straight is two vertices tens of
 * metres apart while a hairpin packs a dozen into a few metres.
 */
export function pointAlong(points, target) {
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

/**
 * A line across the track at the lap start, and optionally an arrowhead further along showing
 * which way the lap runs.
 *
 * The arrow is omitted where the direction is not in the data. Drawing one anyway would state
 * something the source does not support, and a driver reading the map would have no way to tell
 * the difference.
 */
export function startFinishTick(canvasLoop, { withArrow = true } = {}) {
  const [x, y] = canvasLoop[0];
  // Offsets are in canvas units so they stay visually identical across circuits, which are drawn
  // at slightly different scales.
  const [ax0, ay0] = pointAlong(canvasLoop, 26);
  const angle = Math.atan2(ay0 - y, ax0 - x);
  const half = TRACK_WIDTH / 2 + 7;
  const nx = Math.cos(angle + Math.PI / 2) * half;
  const ny = Math.sin(angle + Math.PI / 2) * half;
  const line = [round1(x + nx), round1(y + ny), round1(x - nx), round1(y - ny)];
  if (!withArrow) return { line, arrow: null };

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
  return { line, arrow: arrow.map(([px, py]) => `${round1(px)},${round1(py)}`).join(" ") };
}

/**
 * Fits a lap onto the canvas and returns everything the drawing needs.
 *
 * The frame is taken from the circuit alone: a pit lane can run outside it and must not shrink
 * the track. Corner positions come back normalised to the canvas, the same convention markers
 * use, so they survive the image being displayed at any size.
 */
export function layout(loop, { pitGeometry = null, minTurn, mergeGap, withArrow = true, withStartTick = true }) {
  const origin = loop[0];
  const metres = project(loop, origin);
  const lapMetres = pathLength(metres);

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

  const canvas = metres.map(toCanvas);
  const corners = findCorners(metres, { minTurn, mergeGap }).map((corner, index) => {
    const [x, y] = toCanvas(corner.point);
    return { number: index + 1, label: `T${index + 1}`, x: round4(x / VIEW.width), y: round4(y / VIEW.height), turn: corner.turn };
  });

  return {
    lapMetres,
    corners,
    canvas,
    pitCanvas: pitGeometry ? project(pitGeometry, origin).map(toCanvas) : null,
    startTick: withStartTick ? startFinishTick(canvas, { withArrow }) : null,
  };
}

/**
 * Draws a fitted lap.
 *
 * The artwork carries no background and no light or dark theme: an SVG shown through an img tag
 * is its own document and cannot see the app's toggle, so following prefers-color-scheme put a
 * dark map inside a light app whenever the two disagreed. The app's map viewport supplies the
 * surface, already themed, and every colour here is a mid-tone that reads on both of its
 * backgrounds (#f5f7fb light, #1d2a3a dark).
 */
export function renderSvg({ title, description, caption, generator, provenance, built }) {
  const { canvas, pitCanvas, startTick } = built;
  const legendWidth = startTick?.arrow ? 290 : startTick ? 210 : 130;

  return `<!--
  Generated by ${generator}.
  Do not hand-edit: re-run the script instead, and re-paste the corner list it prints.

${provenance.split("\n").map((line) => (line ? `  ${line}` : "")).join("\n")}
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${description}</desc>
  <style>
    /* An SVG shown through &lt;img&gt; is its own document: it cannot see the app's light/dark
       toggle, and following prefers-color-scheme instead put a dark map inside a light app
       whenever the two disagreed. So the artwork carries no background and no theme of its own.
       The app's map viewport supplies the surface, already themed, and every colour below is a
       mid-tone chosen to read on both of its backgrounds (#f5f7fb light, #1d2a3a dark). */
    .map-caption { fill: #7f8c9e; }
    .map-legend-surface { fill: #8896aa; fill-opacity: 0.14; stroke: #8896aa; stroke-opacity: 0.3; }
    .map-legend-label { fill: #7f8c9e; }
    .map-outline { stroke: #7f8c9e; }
    /* The start line and the direction arrow sit on the track itself, so they take their contrast
       from it rather than from the page, and white works the same in either theme. Their legend
       swatches sit on the panel instead and stay in the label colour. */
    .map-mark { fill: #ffffff; stroke: #ffffff; }
    .map-legend-mark { fill: #7f8c9e; stroke: #7f8c9e; }
  </style>
  <!-- The circuit name is deliberately absent: the app shows it in the top bar and as the page
       heading, so repeating it here put three copies on one screen. -->
  <text class="map-caption" x="60" y="76" font-family="Arial, Helvetica, sans-serif" font-size="20">${caption}</text>

  <!-- A neutral outline rather than a drop shadow: it separates the track from the viewport grid
       and from itself where the lap runs back alongside, and it does that on either background. -->
  <g class="map-outline" fill="none" stroke-width="${TRACK_WIDTH + 10}" stroke-linecap="round" stroke-linejoin="round" opacity="0.22">
    <path d="${toPath(canvas)}"/>
  </g>
${pitCanvas ? `
  <!-- Pit lane, intentionally shown separately from the circuit loop. -->
  <path d="${toPath(pitCanvas)}" fill="none" stroke="#94a3b8" stroke-width="10" stroke-dasharray="18 14" stroke-linecap="round"/>
` : ""}
  <path d="${toPath(canvas)}" fill="none" stroke="#3b82f6" stroke-width="${TRACK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>

${startTick ? `  <!-- ${startTick.arrow ? "Start/finish, and the racing direction taken from the ways' oneway tagging." : "Start/finish only. The source carries no oneway tagging, so the direction is not drawn."} -->
  <line class="map-mark" x1="${startTick.line[0]}" y1="${startTick.line[1]}" x2="${startTick.line[2]}" y2="${startTick.line[3]}" stroke-width="6" stroke-linecap="round"/>
` : "  <!-- No start/finish line: the source records neither a start line nor a direction. -->\n"}${startTick?.arrow ? `  <polygon class="map-mark" points="${startTick.arrow}" stroke-width="1"/>\n` : ""}
  <g font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">
    <g transform="translate(60 ${VIEW.height - 130})"><rect class="map-legend-surface" width="${legendWidth}" height="86" rx="16"/><line x1="22" y1="28" x2="38" y2="28" stroke="#3b82f6" stroke-width="8" stroke-linecap="round"/><text class="map-legend-label" x="52" y="35">Circuit</text>${pitCanvas ? `<line x1="176" y1="28" x2="192" y2="28" stroke="#94a3b8" stroke-width="6" stroke-dasharray="5 4"/><text class="map-legend-label" x="206" y="35">Pit lane</text>` : ""}${startTick ? `<line class="map-legend-mark" x1="30" y1="50" x2="30" y2="66" stroke-width="5" stroke-linecap="round"/><text class="map-legend-label" x="52" y="65">Start</text>` : ""}${startTick?.arrow ? `<polygon class="map-legend-mark" points="176,58 192,64 176,70"/><text class="map-legend-label" x="206" y="65">Direction</text>` : ""}</g>
  </g>

  <text class="map-caption" x="60" y="${VIEW.height - 22}" font-family="Arial, Helvetica, sans-serif" font-size="13">Schematic generated from OpenStreetMap raceway geometry · © OpenStreetMap contributors · ODbL 1.0</text>
</svg>
`;
}

/** Prints the TrackCorner[] literal to paste into lib/track-map/built-in-maps.ts. */
export function printCorners(constant, corners, generator) {
  console.log(`// Generated by ${generator}. Do not hand-edit; re-run the script.`);
  console.log(`export const ${constant}: TrackCorner[] = [`);
  for (const corner of corners) {
    console.log(`  { number: ${corner.number}, label: "${corner.label}", x: ${corner.x}, y: ${corner.y} },`);
  }
  console.log("];");
}
