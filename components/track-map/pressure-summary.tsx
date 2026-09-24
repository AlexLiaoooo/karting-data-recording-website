"use client";

import { formatGain, type AxleSummary } from "@/lib/pressure";
import { useTranslation } from "@/lib/i18n";

/** A single figure where the Runs agree or there is only one; a range and a mean otherwise. */
function axleFigures(summary: AxleSummary) {
  return {
    single: summary.runs === 1 || summary.min === summary.max,
    value: formatGain(summary.mean),
    min: formatGain(summary.min),
    max: formatGain(summary.max),
    mean: formatGain(summary.mean),
  };
}

/**
 * A group of Runs' pressure gain, front then rear, one line each.
 *
 * Shared by a circuit's Layout page and the Run editor, so the same Runs cannot be described two
 * different ways on two screens. Every t() call is written out literally: the translation test
 * finds keys by reading the source, so a key passed through a variable would escape it.
 */
export function PressureAxles({ front, rear, className = "pressure-axles" }: { front: AxleSummary | null; rear: AxleSummary | null; className?: string }) {
  const { t } = useTranslation();
  const frontFigures = front && axleFigures(front);
  const rearFigures = rear && axleFigures(rear);
  if (!frontFigures && !rearFigures) return null;

  return (
    <p className={className}>
      {frontFigures && (frontFigures.single
        ? t("front {value} psi", { value: frontFigures.value })
        : t("front {min} to {max} psi · mean {mean}", { min: frontFigures.min, max: frontFigures.max, mean: frontFigures.mean }))}
      {frontFigures && rearFigures && <br />}
      {rearFigures && (rearFigures.single
        ? t("rear {value} psi", { value: rearFigures.value })
        : t("rear {min} to {max} psi · mean {mean}", { min: rearFigures.min, max: rearFigures.max, mean: rearFigures.mean }))}
    </p>
  );
}
