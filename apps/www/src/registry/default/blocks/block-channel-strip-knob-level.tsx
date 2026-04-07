"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripFooter,
  ChannelStripHeader,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/default/ui/audio/elements/channel-strip";
import { Knob } from "@/registry/default/ui/audio/elements/knob";

export default function BlockChannelStripKnobLevel() {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(50);

  return (
    <ChannelStrip aria-label="Level control strip">
      <ChannelStripHeader>Channel 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel id={labelId}>Level</ChannelStripLabel>
          <Knob
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={knobId}
            max={100}
            min={0}
            onValueChange={setValue}
            size="lg"
            value={value}
          />
          <ChannelStripValue id={valueId} title={`${value}%`}>
            {value}%
          </ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}
