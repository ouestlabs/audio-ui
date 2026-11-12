import { pitchClassName } from "@audio-ui/core";
import {
  ACX,
  type AcxCheck,
  type SoundReport as Report,
} from "@audio-ui/engine/analysis";
import { formatLevel, formatTempo } from "@audio-ui/engine/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/base/ui/dialog";

interface SoundReportProps {
  onOpenChange: (open: boolean) => void;
  /** What the sound was read as: `null` closes the dialog. */
  report: Report | null;
}

/** One reading and what it is. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

/** One ACX requirement: what it asks, the level measured, and whether it holds. */
function Requirement({
  check,
  label,
  want,
}: {
  check: AcxCheck;
  label: string;
  want: string;
}) {
  return (
    <Row
      label={`${label}, ${want}`}
      value={`${check.value === null ? "Not measurable" : formatLevel(check.value, "dBFS")}, ${check.pass ? "passes" : "fails"}`}
    />
  );
}

/**
 * What a sound was read as, in a dialog: its loudness and peaks, its key and
 * tempo when it has them, and each of ACX's audiobook requirements with
 * whether the sound meets it. Controlled: it is open while `report` is set.
 */
export function SoundReport({ onOpenChange, report }: SoundReportProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={report !== null}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Analysis</DialogTitle>
          <DialogDescription>
            Read from the sound as edited, effects left out.
          </DialogDescription>
        </DialogHeader>
        {report ? (
          <div className="flex flex-col gap-4">
            <dl>
              <Row
                label="Loudness"
                value={formatLevel(report.loudness.lufs, "LUFS")}
              />
              <Row
                label="True peak"
                value={formatLevel(report.loudness.truePeak, "dBTP")}
              />
              <Row
                label="Key"
                value={
                  report.key
                    ? `${pitchClassName(report.key.root)} ${report.key.name}`
                    : "None found"
                }
              />
              <Row
                label="Tempo"
                value={report.tempo ? formatTempo(report.tempo) : "None found"}
              />
            </dl>
            <div>
              <h3 className="font-medium text-sm">
                ACX audiobook: {report.acx.pass ? "passes" : "does not pass"}
              </h3>
              <dl>
                <Requirement
                  check={report.acx.rms}
                  label="RMS"
                  want={`${ACX.minRms} to ${ACX.maxRms} dBFS`}
                />
                <Requirement
                  check={report.acx.peak}
                  label="Peak"
                  want={`at most ${ACX.maxPeak} dBFS`}
                />
                <Requirement
                  check={report.acx.noiseFloor}
                  label="Noise floor"
                  want={`at most ${ACX.maxNoiseFloor} dBFS`}
                />
              </dl>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
