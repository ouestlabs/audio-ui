"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripHeader,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/bases/base/ui/audio/elements/channel-strip";
import { Fader } from "@/registry/bases/base/ui/audio/elements/fader";

export default function BlockChannelStripFaderSlider() {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(72);

  return (
    <ChannelStrip aria-label="Fader control" orientation="horizontal">
      <ChannelStripHeader>
        <ChannelStripLabel id={labelId}>Fader</ChannelStripLabel>
        <ChannelStripValue id={valueId} title={`${value}%`}>
          {value}%
        </ChannelStripValue>
      </ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <Fader
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={faderId}
            max={100}
            min={0}
            onValueChange={setValue}
            value={value}
          />
        </ChannelStripSection>
      </ChannelStripContent>
    </ChannelStrip>
  );
}
