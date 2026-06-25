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
} from "@/registry/bases/base/ui/audio/elements/channel-strip";
import { Knob } from "@/registry/bases/base/ui/audio/elements/knob";

export default function BlockChannelStripKnobMacro() {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(40);

  return (
    <ChannelStrip aria-label="Macro control strip">
      <ChannelStripHeader>Channel 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel id={labelId}>Macro</ChannelStripLabel>
          <Knob
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={knobId}
            max={100}
            min={0}
            onValueChange={setValue}
            size="xl"
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
