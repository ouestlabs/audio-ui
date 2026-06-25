"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/bases/base/ui/audio/elements/channel-strip";
import { Fader } from "@/registry/bases/base/ui/audio/elements/fader";

export default function BlockChannelStripFaderHorizontal() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(64);

  return (
    <ChannelStrip aria-label="Fader control" orientation="horizontal">
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel id={labelId}>Fader</ChannelStripLabel>
          <Fader
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={faderId}
            max={100}
            min={0}
            onValueChange={setValue}
            value={value}
          />
          <ChannelStripValue id={valueId} title={`${value}%`}>
            {value}%
          </ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
    </ChannelStrip>
  );
}
