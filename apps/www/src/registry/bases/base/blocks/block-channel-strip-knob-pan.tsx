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

function formatPan(value: number): string {
  if (value === 0) {
    return "C";
  }
  return value < 0 ? `L${Math.abs(value)}` : `R${value}`;
}

export default function BlockChannelStripKnobPan() {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(0);

  return (
    <ChannelStrip aria-label="Pan control strip">
      <ChannelStripHeader>Channel 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel id={labelId}>Pan</ChannelStripLabel>
          <Knob
            anchor={0}
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={knobId}
            max={100}
            min={-100}
            onValueChange={setValue}
            size="lg"
            value={value}
          />
          <ChannelStripValue id={valueId}>{formatPan(value)}</ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}
