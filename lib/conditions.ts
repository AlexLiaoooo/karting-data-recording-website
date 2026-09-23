import type { EventRecord, SessionRecord } from "./types";

export type TrackCondition = EventRecord["condition"];

export type ResolvedConditions = {
  condition: TrackCondition;
  ambientTemperature: string;
  trackTemperature: string;
  /** True for each value that came from the Event because the Session did not record its own. */
  inherited: { condition: boolean; ambientTemperature: boolean; trackTemperature: boolean };
};

/**
 * What a Session was actually run in.
 *
 * Conditions used to live on the Event alone, so a wet Heat 2 inside a dry Event was recorded as
 * dry — in the track notes it was stamped onto, in which reference note a marker showed trackside,
 * and in every figure that grouped Runs by condition. A Session may now record its own; where it
 * does not, it inherits the Event's.
 *
 * Every reader goes through here rather than reading the Session fields, because a blank field
 * means "same as the Event", not "unknown", and reading it directly would get that wrong.
 */
export function sessionConditions(event: EventRecord, session: SessionRecord): ResolvedConditions {
  const own = {
    condition: session.condition,
    ambientTemperature: session.ambientTemperature?.trim() ?? "",
    trackTemperature: session.trackTemperature?.trim() ?? "",
  };
  return {
    condition: own.condition ?? event.condition,
    ambientTemperature: own.ambientTemperature || event.ambientTemperature,
    trackTemperature: own.trackTemperature || event.trackTemperature,
    inherited: {
      condition: own.condition === undefined,
      ambientTemperature: !own.ambientTemperature,
      trackTemperature: !own.trackTemperature,
    },
  };
}
