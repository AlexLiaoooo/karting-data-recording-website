/**
 * Builds the built-in Clay Pigeon Raceway circuit map, and its corner list, from one committed
 * OpenStreetMap extract.
 *
 * Run: node scripts/build-clay-pigeon-map.mjs
 * Writes public/maps/clay-pigeon.svg and prints the TrackCorner[] literal for
 * lib/track-map/built-in-maps.ts.
 *
 * This is the cleanest of the four built-in circuits. Like Buckmore Park, the whole lap is a single
 * closed way tagged oneway=yes, so neither the circuit nor the direction it runs has to be chosen.
 * Unlike Buckmore it has no cut-through ways at all, so there is no second layout for the extract
 * to be ambiguous about, and unlike Buckmore its pit lane is complete: three ways chain into one
 * 129 m run that leaves the circuit and rejoins it, which is long enough to draw as a lane rather
 * than a dash. Only Whilton Mill's maps otherwise show one.
 *
 * The venue is identified by way 103913854 rather than by position: a leisure=sports_centre named
 * Clay Pigeon Raceway, tagged sport=karting, carrying the postcode DT2 9PW and the circuit's own
 * website. Picking a kart circuit out of an extract by coordinates alone is how the wrong venue
 * gets mapped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { layout, nodeKey, pathLength, printCorners, project, renderSvg } from "./lib/circuit-map.mjs";

const GENERATOR = "scripts/build-clay-pigeon-map.mjs";
const OSM = JSON.parse(readFileSync("scripts/data/clay-pigeon-osm.json", "utf8"));
const ways = new Map(OSM.elements.filter((element) => element.type === "way").map((way) => [way.id, way]));

/** The circuit: one closed way carrying the whole lap. */
const CIRCUIT_WAY = 224082157;
/**
 * The pit lane, in travel order. All three are tagged oneway=yes, so this is the order a kart uses
 * them: the first way leaves the circuit and the last rejoins it. The middle one is tagged
 * covered=yes, which is the building the lane runs through.
 */
const PIT_WAYS = [1208357095, 1208357096, 224116637];

// Degrees; a vertex group turning less than this reads as part of a straight. Held at the 38 that
// Whilton Mill settled on so every OpenStreetMap-derived circuit labels corners at the same level
// of detail.
//
// Nothing calibrates it here. Buckmore Park could be checked against a single published count of
// twelve, but the listings for this circuit disagree with each other: eight, nine and twelve are
// all published for the same layout, and the nine-corner list names only eight of them. Tuning the
// threshold until it matched one of those would be picking a source rather than measuring the
// circuit, so the shared value is left alone.
//
// It finds eight, which is both the count the most specific listing gives and the number the
// nine-corner list actually names. That agreement is worth having, but it was arrived at rather
// than aimed for.
const MIN_CORNER_TURN = Number(process.env.MIN_CORNER_TURN ?? 38);
const MERGE_GAP = Number(process.env.MERGE_GAP ?? 8);

const circuit = ways.get(CIRCUIT_WAY);
if (!circuit) throw new Error(`Way ${CIRCUIT_WAY} is missing from the extract.`);
if (circuit.tags?.oneway !== "yes") {
  throw new Error("The circuit way is no longer tagged oneway=yes, so its node order can no longer be trusted as the racing direction.");
}
if (nodeKey(circuit.geometry[0]) !== nodeKey(circuit.geometry.at(-1))) throw new Error("The circuit way is not a closed loop.");

/**
 * Joins the pit lane ways end to end, in the order they are listed.
 *
 * Every one is tagged oneway=yes, so a join that fails means the data changed rather than that a
 * segment needs reversing; reversing one to make it fit would draw a lane running backwards.
 */
function chainPitLane(refs) {
  const first = ways.get(refs[0]);
  if (!first) throw new Error(`Pit lane way ${refs[0]} is missing from the extract.`);
  const lane = [...first.geometry];
  for (const ref of refs.slice(1)) {
    const way = ways.get(ref);
    if (!way) throw new Error(`Pit lane way ${ref} is missing from the extract.`);
    if (way.tags?.oneway !== "yes") throw new Error(`Pit lane way ${ref} is no longer tagged oneway=yes, so its direction cannot be trusted.`);
    if (nodeKey(way.geometry[0]) !== nodeKey(lane.at(-1))) throw new Error(`Pit lane way ${ref} no longer starts where the previous one ends.`);
    lane.push(...way.geometry.slice(1));
  }
  return lane;
}

const pitLane = chainPitLane(PIT_WAYS);
const ringNodes = circuit.geometry.slice(0, -1).map(nodeKey);
const pitEntry = ringNodes.indexOf(nodeKey(pitLane[0]));
const pitExit = ringNodes.indexOf(nodeKey(pitLane.at(-1)));
if (pitEntry === -1) throw new Error("The pit lane no longer leaves the circuit at a shared node.");
if (pitExit === -1) throw new Error("The pit lane no longer rejoins the circuit at a shared node.");

/**
 * Rotates the closed way so the lap begins where the pit lane rejoins it.
 *
 * A closed way starts wherever the surveyor happened to begin, which is not the start line. The
 * pit exit is the nearest thing the data records to one, and it is where a kart rejoins the
 * circuit, so it is used here as it is for Buckmore Park and Whilton Mill's cadet circuit.
 *
 * It also puts the corners in the order the circuit numbers them. The pit lane bypasses the
 * stretch between its entry and its exit, which is the pit straight, so starting at the exit means
 * the first corner the lap reaches is the first corner after the straight.
 */
function rotateTo(geometry, index) {
  const open = geometry.slice(0, -1);
  const rotated = [...open.slice(index), ...open.slice(0, index)];
  return [...rotated, rotated[0]];
}

const ring = rotateTo(circuit.geometry, pitExit);

// Reported rather than corrected: the way's node order is the racing direction because it is
// tagged oneway, so the drawn lap must be left exactly as tagged. Naming the handedness here keeps
// the registry entry honest about where it came from, and it independently agrees with the
// clockwise layout the circuit's listings describe.
const metres = project(ring, ring[0]);
const twiceArea = metres.slice(1).reduce((total, point, index) => total + (metres[index][0] * point[1] - point[0] * metres[index][1]), 0);
const handedness = twiceArea > 0 ? "Clockwise" : "Anti-clockwise";

const built = layout(ring, { pitGeometry: pitLane, minTurn: MIN_CORNER_TURN, mergeGap: MERGE_GAP });

const PROVENANCE = `The lap is a single closed OpenStreetMap way tagged oneway=yes, so both the circuit and the
direction it runs come straight from the data rather than being chosen. The lap begins at the pit
exit, which is the nearest thing the source records to a start line.

The dashed pit lane is three ways chained in their tagged direction, drawn because it is a complete
run from the circuit and back to it rather than a stub.

Length is the measured centreline, which runs shorter than the figure the circuit publishes.

The artwork carries no light or dark theme; see the style block.`;

writeFileSync("public/maps/clay-pigeon.svg", renderSvg({
  title: "Clay Pigeon Raceway kart circuit schematic",
  description: "A schematic of the Clay Pigeon Raceway kart circuit, with the start/finish line, the racing direction and a dashed pit lane, all taken from OpenStreetMap.",
  caption: `Clay Pigeon Raceway - ${Math.round(built.lapMetres).toLocaleString("en-GB")} m centreline`,
  generator: `${GENERATOR} from scripts/data/clay-pigeon-osm.json`,
  provenance: PROVENANCE,
  built,
}));

const pitMetres = pathLength(project(pitLane, ring[0]));
console.error(`public/maps/clay-pigeon.svg  ${Math.round(built.lapMetres)} m  ${built.corners.length} corners  ${handedness}`);
printCorners("BUILT_IN_CLAY_PIGEON_CORNERS", built.corners, GENERATOR);
console.error(`\nCorner turn angles (degrees, sign is turn direction):\n  ${built.corners.map((corner) => `${corner.label}:${corner.turn}`).join("  ")}`);
console.error(`\nPit lane ${Math.round(pitMetres)} m, leaving the lap at ring index ${pitEntry} and rejoining at ${pitExit}, which is where the lap now starts.`);
console.error(`Published: 815 m; corner count varies by listing (8, 9 and 12). Measured centreline: ${Math.round(built.lapMetres)} m, ${built.corners.length} corners detected, running ${handedness.toLowerCase()}.`);
