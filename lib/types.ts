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
  version: 1;
  events: EventRecord[];
  lastEventId: string | null;
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

export const createRun = (number: number, previous?: RunRecord): RunRecord => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number,
    label: "",
    recordedAt: now,
    laps: "",
    tyres: previous
      ? structuredClone(previous.tyres)
      : { fl: emptyTyre(), fr: emptyTyre(), rl: emptyTyre(), rr: emptyTyre() },
    setup: previous ? structuredClone(previous.setup) : emptySetup(),
    fastestLap: "",
    averageLap: "",
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

