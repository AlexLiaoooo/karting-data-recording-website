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
import { layout, nodeKey, printCorners, renderSvg } from "./lib/circuit-map.mjs";

const GENERATOR = "scripts/build-whilton-maps.mjs";
const OSM = JSON.parse(readFileSync("scripts/data/whilton-mill-osm.json", "utf8"));
const ways = new Map(OSM.elements.filter((element) => element.type === "way").map((way) => [way.id, way]));
const relations = new Map(OSM.elements.filter((element) => element.type === "relation").map((rel) => [rel.id, rel]));

/** The way carrying the pit lane past the main complex; drawn separately, never part of a lap. */
const MAIN_PIT_LANE = 1208334015;

const CIRCUITS = [
  { key: "whilton-mill-international", file: "whilton-mill-international", name: "International", relation: 16338535, pitLane: MAIN_PIT_LANE },
];

/**
 * Degrees. A vertex group turning less than this reads as part of a straight.
 *
 * Set per circuit rather than shared with scripts/derive-corners.mjs, which uses 55 for PF
 * International: the number encodes the owner's judgement of what counts as a corner here, and
 * the two circuits do not answer that the same way. 55 missed the left-hand bend out of the
 * start straight, which he counts as Turn 1 and which measures 44 degrees.
 *
 * 38 sits mid-plateau. Every value from 34 to 42 yields the same twelve corners, so the
 * threshold is not perched on an edge: 43 and above drops Turn 1 again, and 33 and below picks
 * up a 31-degree kink he does not count.
 */
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 38);
// Metres; bridges a brief straight inside one long corner. 8 sits mid-plateau: this circuit
// yields the same corner count at every value from 6 to 14, so the threshold is not perched
// on an edge.
const MERGE_GAP = Number(process.env.MERGE_GAP ?? 8);

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

const PROVENANCE = `The lap is chained from OpenStreetMap raceway ways in their tagged oneway direction, so the
start/finish tick and arrow show the real racing direction rather than a drawing convention.
Length is the measured centreline, which is shorter than the figure an operator publishes for
the same circuit; it is labelled "centreline" rather than presented as the official distance.

The artwork is deliberately transparent and carries no light or dark theme; see the style block.`;

for (const circuit of CIRCUITS) {
  const relation = relations.get(circuit.relation);
  if (!relation) throw new Error(`Relation ${circuit.relation} is missing from the extract.`);
  const refs = relation.members
    .filter((member) => member.type === "way" && member.ref !== circuit.pitLane)
    .map((member) => member.ref);
  const { chain, loop } = chainWays(refs, "Home Straight");

  const pitWay = ways.get(circuit.pitLane);
  if (!pitWay) throw new Error(`Pit lane way ${circuit.pitLane} is missing from the extract.`);

  const built = layout(loop, {
    pitGeometry: pitWay.geometry,
    minTurn: MIN_CORNER_TURN,
    mergeGap: MERGE_GAP,
  });

  const path = `public/maps/${circuit.file}.svg`;
  writeFileSync(path, renderSvg({
    title: `Whilton Mill ${circuit.name} Circuit schematic`,
    description: `A schematic of the ${circuit.name} circuit at Whilton Mill, with the start/finish line, the racing direction and a dashed pit lane.`,
    caption: `${circuit.name} Circuit · ${Math.round(built.lapMetres).toLocaleString("en-GB")} m centreline`,
    generator: `${GENERATOR} from scripts/data/whilton-mill-osm.json`,
    provenance: PROVENANCE,
    built,
  }));

  console.error(`${path}  ${Math.round(built.lapMetres)} m  ${chain.length} ways  ${built.corners.length} corners`);
  printCorners(`BUILT_IN_${circuit.key.replace(/-/g, "_").toUpperCase()}_CORNERS`, built.corners, GENERATOR);
  console.error(`\nCorner turn angles (degrees, sign is turn direction):\n  ${built.corners.map((c) => `${c.label}:${c.turn}`).join("  ")}`);
}
