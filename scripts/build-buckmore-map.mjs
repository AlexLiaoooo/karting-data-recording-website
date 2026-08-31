/**
 * Builds the built-in Buckmore Park circuit map, and its corner list, from one committed
 * OpenStreetMap extract.
 *
 * Run: node scripts/build-buckmore-map.mjs
 * Writes public/maps/buckmore-park.svg and prints the TrackCorner[] literal for
 * lib/track-map/built-in-maps.ts.
 *
 * This is the easiest of the three OpenStreetMap circuits to derive. Buckmore Park maps its main
 * circuit as a single closed way tagged oneway=yes, so the lap is the way itself and the racing
 * direction is the order of its nodes — neither has to be chosen, unlike Kart Silverstone, and
 * nothing has to be chained, unlike Whilton Mill.
 *
 * The rest of the extract is deliberately unused: five short cut-throughs join two points of the
 * main loop to make the shorter layouts the circuit also runs, two more ways are access roads, and
 * the two named Pit Lane ways are stubs of 11 and 28 metres. A pit lane that short would draw as
 * two dashes rather than a lane, so none is drawn; its exit node is still used, to start the lap.
 */
import { readFileSync } from "node:fs";
import { layout, nodeKey, printCorners, project, renderSvg, writeArtwork } from "./lib/circuit-map.mjs";

const GENERATOR = "scripts/build-buckmore-map.mjs";
const OSM = JSON.parse(readFileSync("scripts/data/buckmore-park-osm.json", "utf8"));
const ways = new Map(OSM.elements.filter((element) => element.type === "way").map((way) => [way.id, way]));

/** The main circuit: one closed way carrying the whole lap. */
const CIRCUIT_WAY = 92128535;
/** The pit lane way that rejoins the circuit; its last node is the pit exit. */
const PIT_EXIT_WAY = 1208377062;

// Degrees; a vertex group turning less than this reads as part of a straight. Held at the 38 that
// Whilton Mill settled on so every OpenStreetMap-derived circuit labels corners at the same level
// of detail. The circuit publishes 12 turns for this layout.
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 38);
const MERGE_GAP = Number(process.env.MERGE_GAP ?? 8);

const circuit = ways.get(CIRCUIT_WAY);
if (!circuit) throw new Error(`Way ${CIRCUIT_WAY} is missing from the extract.`);
if (circuit.tags?.oneway !== "yes") {
  throw new Error("The circuit way is no longer tagged oneway=yes, so its node order can no longer be trusted as the racing direction.");
}
if (nodeKey(circuit.geometry[0]) !== nodeKey(circuit.geometry.at(-1))) throw new Error("The circuit way is not a closed loop.");

/**
 * Rotates the closed way so the lap begins where the pit lane rejoins it.
 *
 * A closed way starts wherever the surveyor happened to begin, which is not the start line. The
 * pit exit is the nearest thing the data records to one, and it is where a kart rejoins the
 * circuit, so it is used here as it is for Whilton Mill's cadet circuit.
 */
function rotateToPitExit(geometry, pitWay) {
  const exit = nodeKey(pitWay.geometry.at(-1));
  const open = geometry.slice(0, -1);
  const index = open.findIndex((point) => nodeKey(point) === exit);
  if (index === -1) throw new Error("The pit lane no longer rejoins the circuit at a shared node.");
  const rotated = [...open.slice(index), ...open.slice(0, index)];
  return [...rotated, rotated[0]];
}

const pitWay = ways.get(PIT_EXIT_WAY);
if (!pitWay) throw new Error(`Pit lane way ${PIT_EXIT_WAY} is missing from the extract.`);
const ring = rotateToPitExit(circuit.geometry, pitWay);

// Reported rather than corrected: the way's node order is the racing direction because it is
// tagged oneway, so the drawn lap must be left exactly as tagged. Naming the handedness here keeps
// the registry entry honest about where it came from.
const metres = project(ring, ring[0]);
const twiceArea = metres.slice(1).reduce((total, point, index) => total + (metres[index][0] * point[1] - point[0] * metres[index][1]), 0);
const handedness = twiceArea > 0 ? "Clockwise" : "Anti-clockwise";

const built = layout(ring, { minTurn: MIN_CORNER_TURN, mergeGap: MERGE_GAP });

const PROVENANCE = `The lap is a single closed OpenStreetMap way tagged oneway=yes, so both the circuit and the
direction it runs come straight from the data rather than being chosen. The lap begins at the pit
exit, which is the nearest thing the source records to a start line.

Length is the measured centreline, which runs shorter than the figure the circuit publishes.

The artwork carries no light or dark theme; see the style block.`;

writeArtwork("public/maps/buckmore-park.svg", renderSvg({
  title: "Buckmore Park kart circuit schematic",
  description: "A schematic of the Buckmore Park kart circuit, with the start/finish line and the racing direction taken from OpenStreetMap.",
  caption: `Buckmore Park · ${Math.round(built.lapMetres).toLocaleString("en-GB")} m centreline`,
  generator: `${GENERATOR} from scripts/data/buckmore-park-osm.json`,
  provenance: PROVENANCE,
  built,
}));

console.error(`public/maps/buckmore-park.svg  ${Math.round(built.lapMetres)} m  ${built.corners.length} corners  ${handedness}`);
printCorners("BUILT_IN_BUCKMORE_PARK_CORNERS", built.corners, GENERATOR);
console.error(`\nCorner turn angles (degrees, sign is turn direction):\n  ${built.corners.map((corner) => `${corner.label}:${corner.turn}`).join("  ")}`);
console.error(`\nPublished: 929 m, 12 turns. Measured centreline: ${Math.round(built.lapMetres)} m, ${built.corners.length} corners detected, running ${handedness.toLowerCase()}.`);
