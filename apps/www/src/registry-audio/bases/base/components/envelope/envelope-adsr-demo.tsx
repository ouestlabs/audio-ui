"use client";

import { useState } from "react";
import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";

/** The span the envelope's x axis stands for, in milliseconds. */
const SPAN_MS = 2000;

const INITIAL_POINTS = [
  { x: 0, y: 0 },
  { x: 0.08, y: 1 },
  { x: 0.28, y: 0.6 },
  { x: 0.72, y: 0.6 },
  { x: 1, y: 0 },
];

const toMs = (share: number) => `${Math.round(share * SPAN_MS)} ms`;

/**
 * An ADSR from five points: the second is the end of the attack, the third
 * the end of the decay, and the fourth the start of the release. The
 * consumer maps the normalized axes to its own units, here milliseconds
 * and a level.
 */
export default function EnvelopeAdsrDemo() {
  const [points, setPoints] = useState(INITIAL_POINTS);
  const [, peak, decayEnd, releaseStart] = points;

  return (
    <div className="flex w-full flex-col gap-3">
      <Envelope
        aria-label="ADSR envelope"
        maxPoints={5}
        minPoints={5}
        onValueChange={setPoints}
        value={points}
        xDomain={[0, SPAN_MS]}
        xUnit="ms"
        yDomain={[0, 100]}
        yUnit="%"
      />
      {peak && decayEnd && releaseStart ? (
        <dl className="grid grid-cols-4 gap-2 text-center font-mono text-xs tabular-nums">
          <div>
            <dt className="text-muted-foreground">Attack</dt>
            <dd>{toMs(peak.x)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Decay</dt>
            <dd>{toMs(decayEnd.x - peak.x)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sustain</dt>
            <dd>{Math.round(decayEnd.y * 100)}%</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Release</dt>
            <dd>{toMs(1 - releaseStart.x)}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
