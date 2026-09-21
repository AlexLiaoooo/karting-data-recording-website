export type TyreCorner = "fl" | "fr" | "rl" | "rr";

export type TyreReading = {
  coldPressure: string;
  hotPressure: string;
  coldTemperature: string;
  hotTemperature: string;
};

export type ChassisSetup = {
  frontTrack: string;
  rearTrack: string;
  frontRideHeight: string;
  rearRideHeight: string;
  frontToe: string;
  frontCamber: string;
  caster: string;
  axleType: string;
  rearHub: string;
  frontTorsionBar: string;
  seatStays: string;
  frontSprocket: string;
  rearSprocket: string;
  wheelType: string;
  notes: string;
};

export type SetupTemplate = {
  id: string;
  name: string;
  setup: ChassisSetup;
  createdAt: string;
  updatedAt: string;
};

export type RunRecord = {
  id: string;
  number: number;
  label: string;
  recordedAt: string;
  laps: string;
  tyres: Record<TyreCorner, TyreReading>;
  setup: ChassisSetup;
  fastestLap: string;
  averageLap: string;
  /** Peak RPM seen on the data logger. Blank on Runs recorded before the field existed. */
  maxRpm: string;
  position: string;
  balance: "" | "Understeer" | "Neutral" | "Oversteer";
  grip: "" | "Low" | "Medium" | "High";
  braking: "" | "Poor" | "Acceptable" | "Good";
  cornerEntry: string;
  midCorner: string;
  cornerExit: string;
  comments: string;
  completed: boolean;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  name: string;
  type: "Practice" | "Qualifying" | "Heat" | "Pre-final" | "Final" | "Other";
  startTime: string;
  notes: string;
  runs: RunRecord[];
  createdAt: string;
};

export type EventRecord = {
  id: string;
  name: string;
  track: string;
  trackLayoutId?: string;
  startDate: string;
  endDate: string;
  type: "Practice" | "Test" | "Race" | "Other";
  weather: string;
  ambientTemperature: string;
  trackTemperature: string;
  condition: "Dry" | "Damp" | "Wet" | "Mixed";
  notes: string;
  sessions: SessionRecord[];
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  version: 2;
  events: EventRecord[];
  lastEventId: string | null;
  setupTemplates: SetupTemplate[];
};

export const emptyTyre = (): TyreReading => ({
  coldPressure: "",
  hotPressure: "",
  coldTemperature: "",
  hotTemperature: "",
});

export const emptySetup = (): ChassisSetup => ({
  frontTrack: "",
  rearTrack: "",
  frontRideHeight: "",
  rearRideHeight: "",
  frontToe: "",
  frontCamber: "",
  caster: "",
  axleType: "",
  rearHub: "",
  frontTorsionBar: "",
  seatStays: "",
  frontSprocket: "",
  rearSprocket: "",
  wheelType: "",
  notes: "",
});

/**
 * Carries a Run's cold tyre readings into the next one and leaves the hot ones blank.
 *
 * Cold pressures are set in the paddock before going out, so repeating them is most of the point
 * of duplicating a Run. Hot pressures and temperatures are measured when the kart comes back in,
 * and copying those forward filled a new Run with the previous Run's measurements — on screen
 * indistinguishable from readings actually taken, and silently wrong in every export and
 * comparison until someone overwrote all eight of them.
 */
function carryColdTyres(tyres: RunRecord["tyres"]): RunRecord["tyres"] {
  const carry = (tyre: TyreReading): TyreReading => ({
    ...emptyTyre(),
    coldPressure: tyre.coldPressure,
    coldTemperature: tyre.coldTemperature,
  });
  return { fl: carry(tyres.fl), fr: carry(tyres.fr), rl: carry(tyres.rl), rr: carry(tyres.rr) };
}

export const createRun = (number: number, previous?: RunRecord): RunRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number,
    label: "",
    recordedAt: now,
    laps: "",
    tyres: previous
      ? carryColdTyres(previous.tyres)
      : { fl: emptyTyre(), fr: emptyTyre(), rl: emptyTyre(), rr: emptyTyre() },
    setup: previous ? structuredClone(previous.setup) : emptySetup(),
    fastestLap: "",
    averageLap: "",
    maxRpm: "",
    position: "",
    balance: "",
    grip: "",
    braking: "",
    cornerEntry: "",
    midCorner: "",
    cornerExit: "",
    comments: "",
    completed: false,
    updatedAt: now,
  };
};
