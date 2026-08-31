import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_BUCKMORE_PARK_CORNERS,
  BUILT_IN_CLAY_PIGEON_CORNERS,
  BUILT_IN_PFI_CORNERS,
  BUILT_IN_SILVERSTONE_GRAND_PRIX_CORNERS,
  BUILT_IN_TRACKS,
  BUILT_IN_WHILTON_INTERNATIONAL_CORNERS,
} from "./built-in-maps";
import type { TrackCorner } from "./types";

/**
 * Checks that the corner lists this app ships are still the ones their generators produce.
 *
 * The corner lists are generated and then pasted into built-in-maps.ts, so nothing but discipline
 * keeps the two in step. Comparing the artwork instead would not catch this: a change to corner
 * detection renumbers a circuit while leaving every SVG byte identical, because the numbers live in
 * the registry rather than in the drawing. That is not hypothetical — raising MAX_CORNER_TURN from
 * 180 to 200 for Buckmore Park could have quietly renumbered the other circuits, and this check run
 * by hand is what showed it had not.
 *
 * The generators run for real, from their committed extracts, so this also proves each map is still
 * reproducible from its source rather than only from the last person's working copy.
 */
const ROOT = join(__dirname, "../..");

const GENERATORS = [
  ["scripts/build-pfi-map.mjs", { BUILT_IN_PFI_CORNERS }],
  ["scripts/build-whilton-maps.mjs", { BUILT_IN_WHILTON_INTERNATIONAL_CORNERS }],
  ["scripts/build-silverstone-map.mjs", { BUILT_IN_SILVERSTONE_GRAND_PRIX_CORNERS }],
  ["scripts/build-buckmore-map.mjs", { BUILT_IN_BUCKMORE_PARK_CORNERS }],
  ["scripts/build-clay-pigeon-map.mjs", { BUILT_IN_CLAY_PIGEON_CORNERS }],
] as const satisfies ReadonlyArray<readonly [string, Record<string, TrackCorner[]>]>;

/**
 * Runs a generator and parses back the TrackCorner[] literals it prints.
 *
 * CIRCUIT_MAP_CORNERS_ONLY stops it writing its SVG: the test wants stdout, and rewriting the
 * artwork as a side effect of running tests would dirty the working tree wherever git checks files
 * out with CRLF endings.
 */
function printedCorners(script: string): Record<string, TrackCorner[]> {
  const stdout = execFileSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CIRCUIT_MAP_CORNERS_ONLY: "1" },
    // The generators report lengths and turn angles on stderr for a human running them by hand.
    // Useful there, pure noise in a test run.
    stdio: ["ignore", "pipe", "ignore"],
  });

  const lists: Record<string, TrackCorner[]> = {};
  for (const [, name, body] of stdout.matchAll(/export const (\w+): TrackCorner\[\] = \[([\s\S]*?)\n\];/g)) {
    lists[name] = [...body.matchAll(/\{ number: (\d+), label: "([^"]+)", x: (-?[\d.]+), y: (-?[\d.]+) \}/g)]
      .map((corner) => ({ number: Number(corner[1]), label: corner[2], x: Number(corner[3]), y: Number(corner[4]) }));
  }
  return lists;
}

describe("the built-in corner lists still match their generators", () => {
  it.each(GENERATORS.map(([script, expected]) => [script, expected] as const))(
    "%s prints what the registry ships",
    (script, expected) => {
      const printed = printedCorners(script);

      for (const [name, shipped] of Object.entries(expected)) {
        expect(printed[name], `${script} no longer prints ${name}`).toBeDefined();
        expect(printed[name], name).toEqual(shipped);
      }
    },
    30_000,
  );

  /**
   * A circuit added to the registry without being added here would silently stop being checked,
   * which is the failure this whole file exists to prevent.
   */
  it("covers every built-in layout", () => {
    const checked = GENERATORS.flatMap(([, expected]) => Object.values(expected));
    const shipped = BUILT_IN_TRACKS.flatMap((track) => track.layouts.map((layout) => layout.corners));

    expect(checked).toHaveLength(shipped.length);
    for (const corners of shipped) expect(checked).toContain(corners);
  });
});
