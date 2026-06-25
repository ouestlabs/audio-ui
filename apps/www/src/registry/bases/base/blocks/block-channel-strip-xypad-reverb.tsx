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
import { Knob } from "@/registry/bases/base/ui/audio/elements/knob";
import { XYPad } from "@/registry/bases/base/ui/audio/elements/xypad";

export default function BlockChannelStripXypadReverb() {
  const knobId = useId();
  const knobLabelId = useId();
  const knobValueId = useId();
  const [morph, setMorph] = useState({ x: 60, y: 20 });
  const [wet, setWet] = useState(60);

  return (
    <ChannelStrip aria-label="Reverb pad">
      <ChannelStripHeader>Reverb</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <XYPad
            className="aspect-square"
            defaultValue={morph}
            formatValue={(next) => `Color ${next.x} | Space ${next.y}`}
            maxX={100}
            maxY={100}
            minX={-100}
            minY={-100}
            onValueChange={setMorph}
            stepX={1}
            stepY={1}
            value={morph}
          />
        </ChannelStripSection>
        <ChannelStripSection>
          <ChannelStripLabel id={knobLabelId}>Wet</ChannelStripLabel>
          <Knob
            aria-describedby={knobValueId}
            aria-labelledby={knobLabelId}
            id={knobId}
            max={100}
            min={0}
            onValueChange={setWet}
            size="sm"
            value={wet}
          />
          <ChannelStripValue id={knobValueId}>{wet}%</ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
    </ChannelStrip>
  );
}
