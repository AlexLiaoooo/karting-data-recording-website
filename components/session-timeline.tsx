"use client";

import { useId, useMemo } from "react";
import { ChartNoAxesCombined, ChevronRight } from "lucide-react";
import { chartScale, changesFromPrevious, measuredSegments, orderedSessionRuns, sessionSeries, type RunSeries, type TemperatureView, type TimelineMetric } from "@/lib/session-timeline";
import { formatLapTime, parseLapTime } from "@/lib/lap-time";
import { formatGain } from "@/lib/pressure";
import { gearRatio } from "@/lib/gearing";
import { runRecordingPhase } from "@/lib/run-recording";
import { useTranslation, type Translate } from "@/lib/i18n";
import type { RunRecord, SessionRecord } from "@/lib/types";

const metrics: Array<{ key: TimelineMetric; label: string; unit: string }> = [
  { key: "laps", label: "Lap times", unit: "s" },
  { key: "pressure", label: "Pressure gains", unit: "PSI" },
  { key: "temperature", label: "Tyre temperatures", unit: "°C" },
  { key: "gearing", label: "Gearing", unit: "" },
];
const colours = ["var(--blue)", "var(--green)", "var(--purple)", "var(--amber)"];
const dashes = [undefined, "6 3", "2 3", "8 3 2 3"];
const runNumber = (run: RunRecord) => `Run ${String(run.number).padStart(2, "0")}`;
const seriesName = (series: RunSeries, t: Translate) => series.key.length === 2 ? series.label : t(series.label);

function valueText(value: number | null, metric: TimelineMetric) {
  if (value === null) return "—";
  if (metric === "laps") return formatLapTime(value);
  if (metric === "pressure") return formatGain(value);
  if (metric === "gearing") return value.toFixed(2);
  return String(value);
}

function RunChart({ runs, series, metric, unit, temperatureView }: { runs: RunRecord[]; series: RunSeries[]; metric: TimelineMetric; unit: string; temperatureView: TemperatureView }) {
  const { t } = useTranslation();
  const id = useId();
  const scale = chartScale(series, metric === "pressure");
  if (!scale) return <div className="timeline-chart-empty"><ChartNoAxesCombined /><p>{t("No usable readings for this chart yet.")}</p></div>;
  const width = Math.max(320, runs.length * 48 + 64);
  const left = 60;
  const right = width - 18;
  const top = 24;
  const bottom = 200;
  const x = (index: number) => runs.length < 2 ? (left + right) / 2 : left + index * (right - left) / (runs.length - 1);
  const y = (value: number) => bottom - (value / scale.factor - scale.minimum) / (scale.maximum - scale.minimum) * (bottom - top);
  const label = metric === "temperature" ? temperatureView === "cold" ? t("Cold tyre temperatures") : t("Hot tyre temperatures") : t(metrics.find(item => item.key === metric)!.label);
  return (
    <figure className="timeline-figure">
      <div className="timeline-chart-scroll" role="region" aria-label={t("Scrollable Run chart")} tabIndex={0}>
        <svg className="timeline-chart" viewBox={`0 0 ${width} 238`} style={{ minWidth: width }} role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>{t("{metric} across {count} Runs", { metric: label, count: runs.length })}</title>
          <desc id={`${id}-description`}>{t("Points follow Run order. Missing or invalid readings leave gaps. Values are listed in the table below.")}</desc>
          <text x={left} y={14} className="timeline-axis-label">{unit || t("Gear ratio")}</text>
          {Array.from({ length: 5 }, (_, index) => {
            const normalized = scale.maximum - index * (scale.maximum - scale.minimum) / 4;
            const value = normalized * scale.factor;
            const ordinate = top + index * (bottom - top) / 4;
            const text = Math.abs(value) >= 10000 ? value.toExponential(1) : value.toFixed(metric === "laps" ? 3 : metric === "gearing" ? 2 : 1);
            return <g key={index}><line x1={left} x2={right} y1={ordinate} y2={ordinate} className="timeline-grid-line" /><text x={left - 8} y={ordinate + 3} textAnchor="end" className="timeline-axis-label">{text}</text></g>;
          })}
          {series.map((item, index) => <g key={item.key}>
            {measuredSegments(item.values).map((segment, segmentIndex) => <g key={segmentIndex}>
              {segment.length > 1 && <polyline fill="none" stroke={colours[index]} strokeWidth="2" strokeDasharray={dashes[index]} points={segment.map(point => `${x(point.index)},${y(point.value)}`).join(" ")} />}
              {segment.map(point => <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="4" fill={colours[index]} stroke="var(--surface)" strokeWidth="1.5">
                <title>{runNumber(runs[point.index])} · {seriesName(item, t)}: {valueText(point.value, metric)} {unit}</title>
              </circle>)}
            </g>)}
          </g>)}
          {runs.map((run, index) => <text key={run.id} x={x(index)} y={220} textAnchor="middle" className="timeline-axis-label">{String(run.number).padStart(2, "0")}</text>)}
          <text x={left - 8} y={220} textAnchor="end" className="timeline-axis-label">Run</text>
        </svg>
      </div>
      <figcaption>{t("Run order, oldest first. Scroll the chart sideways for longer Sessions.")}</figcaption>
      <ul className="timeline-legend" aria-label={t("Chart legend")}>
        {series.map((item, index) => <li key={item.key}><svg viewBox="0 0 24 10" aria-hidden="true"><line x1="0" x2="24" y1="5" y2="5" stroke={colours[index]} strokeWidth="3" strokeDasharray={dashes[index]} /></svg>{seriesName(item, t)}</li>)}
      </ul>
    </figure>
  );
}

export function SessionTimeline({ session, metric, temperatureView, onMetric, onTemperatureView, onOpen, onCompare }: {
  session: SessionRecord; metric: TimelineMetric; temperatureView: TemperatureView;
  onMetric: (metric: TimelineMetric) => void; onTemperatureView: (view: TemperatureView) => void;
  onOpen: (run: RunRecord) => void; onCompare: (baselineId: string, testId: string) => void;
}) {
  const { t } = useTranslation();
  const runs = useMemo(() => orderedSessionRuns(session.runs), [session.runs]);
  const series = useMemo(() => sessionSeries(runs, metric, temperatureView), [runs, metric, temperatureView]);
  const currentMetric = metrics.find(item => item.key === metric)!;
  if (!runs.length) return <section className="empty-state"><span className="empty-icon"><ChartNoAxesCombined /></span><h2>{t("No Runs to show yet")}</h2><p>{t("Add a Run in this Session to start its timeline.")}</p></section>;
  return <>
    <section className="timeline-chart-card" aria-labelledby="timeline-chart-heading">
      <h2 id="timeline-chart-heading">{t("Run charts")}</h2>
      <div className="timeline-metrics" role="group" aria-label={t("Chart measurement")}>
        {metrics.map(item => <button type="button" key={item.key} aria-pressed={metric === item.key} onClick={() => onMetric(item.key)}>{t(item.label)}</button>)}
      </div>
      {metric === "temperature" && <div className="run-phase-switch" role="group" aria-label={t("Temperature readings")}>
        <button type="button" aria-pressed={temperatureView === "cold"} onClick={() => onTemperatureView("cold")}>{t("Cold tyres")}</button>
        <button type="button" aria-pressed={temperatureView === "hot"} onClick={() => onTemperatureView("hot")}>{t("Hot tyres")}</button>
      </div>}
      <RunChart runs={runs} series={series} metric={metric} unit={currentMetric.unit} temperatureView={temperatureView} />
      <p className="help-text">{t("Charts use recorded values, including unfinished Runs. Missing readings are not zero and lines stop at gaps.")}</p>
      <details className="timeline-values">
        <summary>{t("Chart values")}</summary>
        <div className="timeline-table-scroll" role="region" aria-label={t("Scrollable chart values")} tabIndex={0}>
          <table><caption className="visually-hidden">{t("Chart values")}</caption><thead><tr><th scope="col">Run</th>{series.map(item => <th key={item.key} scope="col">{seriesName(item, t)}{currentMetric.unit && metric !== "laps" ? ` (${currentMetric.unit})` : ""}</th>)}</tr></thead>
            <tbody>{runs.map((run, index) => <tr key={run.id}><th scope="row"><button className="text-button" type="button" onClick={() => onOpen(run)}>{runNumber(run)}</button></th>{series.map(item => <td key={item.key}>{valueText(item.values[index], metric)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
    <section className="session-timeline" aria-labelledby="timeline-runs-heading">
      <div className="section-heading"><h2 id="timeline-runs-heading">{t("Run timeline")}</h2><span className="muted">{t("Oldest first")}</span></div>
      <ol className="timeline-run-list">
        {runs.map((run, index) => {
          const previous = runs[index - 1];
          const changes = previous ? changesFromPrevious(previous, run) : [];
          const fastest = parseLapTime(run.fastestLap);
          const average = parseLapTime(run.averageLap);
          const ratio = gearRatio(run.setup.frontSprocket, run.setup.rearSprocket);
          return <li className="timeline-run-card" key={run.id}>
            <div className="card-head"><h3>{runNumber(run)}{run.label ? ` · ${run.label}` : ""}</h3><span className="badge">{run.completed ? t("Completed") : runRecordingPhase(run) === "before" ? t("Before Run") : t("After Run")}</span></div>
            <dl className="timeline-run-stats">
              <div><dt>{t("Fastest lap")}</dt><dd>{fastest === null ? run.fastestLap || "—" : formatLapTime(fastest)}</dd></div>
              <div><dt>{t("Average lap")}</dt><dd>{average === null ? run.averageLap || "—" : formatLapTime(average)}</dd></div>
              <div><dt>{t("Gear ratio")}</dt><dd>{valueText(ratio !== null && Number.isFinite(ratio) ? ratio : null, "gearing")}</dd></div>
              <div><dt>{t("Max RPM")}</dt><dd>{run.maxRpm || "—"}</dd></div>
            </dl>
            {previous ? changes.length ? <details className="timeline-changes">
              <summary>{t("{count} recorded changes since Run {number}", { count: changes.length, number: String(previous.number).padStart(2, "0") })}</summary>
              <p className="help-text">{t("Changes reflect saved setup and cold-pressure fields, including added or cleared readings.")}</p>
              <dl>{changes.map((change, changeIndex) => <div key={changeIndex}><dt>{change.corner ? `${change.corner.toUpperCase()} · ` : ""}{t(change.label)}</dt><dd>{change.before || "—"}{change.before && change.unit ? ` ${change.unit}` : ""} → {change.after || "—"}{change.after && change.unit ? ` ${change.unit}` : ""}</dd></div>)}</dl>
            </details> : <p className="help-text">{t("No recorded setup or cold-pressure changes since Run {number}.", { number: String(previous.number).padStart(2, "0") })}</p>
              : <p className="help-text">{t("First recorded Run in this Session.")}</p>}
            {(run.balance || run.comments) && <p className="timeline-note"><strong>{t("Driver feedback")}</strong>{run.balance ? ` · ${t(run.balance)}` : ""}{run.comments && <span>{run.comments}</span>}</p>}
            {(run.experiment?.change || run.experiment?.outcome) && <div className="timeline-note"><strong>{t("Setup experiment")}</strong>
              {run.experiment.change && <p>{t("What I changed")}: {run.experiment.change}</p>}
              {run.experiment.outcome && <p>{t("What happened")}: {run.experiment.outcome}</p>}
            </div>}
            <div className="action-stack"><button className="button button-primary button-block" type="button" onClick={() => onOpen(run)}>{t("Open Run {number}", { number: String(run.number).padStart(2, "0") })}<ChevronRight /></button>
              {previous && <button className="button button-secondary button-block" type="button" onClick={() => onCompare(previous.id, run.id)}>{t("Compare with Run {number}", { number: String(previous.number).padStart(2, "0") })}</button>}
            </div>
          </li>;
        })}
      </ol>
    </section>
  </>;
}
