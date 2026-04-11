"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/default/ui/audio/elements/channel-strip";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function BlockChannelStripFaderGainDb() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [gain, setGain] = useState(0);

  return (
    <ChannelStrip aria-label="Gain control">
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel id={labelId}>Gain</ChannelStripLabel>
          <Fader
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={faderId}
            max={6}
            min={-60}
            onValueChange={setGain}
            value={gain}
          />
          <ChannelStripValue id={valueId}>
            {gain > 0 ? `+${gain}` : gain} dB
          </ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
    </ChannelStrip>
  );
}
