"use client";

import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";

const NO_ANALYSERS: readonly AnalyserNode[] = [];

/** What the meter shows before an engine runs. */
const SILENCE = {
  getSnapshot: () => ({ levels: [-60, -60], peaks: [-60, -60] }),
  subscribe: () => () => undefined,
};

/**
 * A track's level, for its header: a thin vertical meter that fills the
 * height it is given, for `TimelineTrackControls`' `meter`. `analysers` are
 * what the engine meters on the track's channel, after its volume, pan and
 * switch, so a silent track reads silence; `null` until an engine runs.
 */
function TrackLevel({
  analysers,
  name,
}: {
  analysers: readonly AnalyserNode[] | null;
  /** The track's name, which the meter is labelled by. */
  name: string;
}) {
  const levels = useAudioLevels(analysers ?? NO_ANALYSERS);
  return (
    <Meter
      aria-label={`${name} level`}
      // Under the same variant as the size's own, so it holds once installed too, where that size is utilities.
      className="gap-px data-[orientation=vertical]:h-full data-[orientation=vertical]:[--meter-thickness:--spacing(1)]"
      orientation="vertical"
      peakMarks="hidden"
      size="sm"
      source={analysers ? levels : SILENCE}
      warnThreshold={-12}
    />
  );
}

export { TrackLevel };
