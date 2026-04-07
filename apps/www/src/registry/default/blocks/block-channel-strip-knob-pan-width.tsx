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

function formatPan(value: number): string {
  if (value === 0) {
    return "C";
  }
  return value < 0 ? `L${Math.abs(value)}` : `R${value}`;
}

function formatSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

export default function BlockChannelStripKnobPanWidth() {
  const panId = useId();
  const panLabelId = useId();
  const panValueId = useId();
  const widthId = useId();
  const widthLabelId = useId();
  const widthValueId = useId();
  const [pan, setPan] = useState(0);
  const [width, setWidth] = useState(0);

  return (
    <ChannelStrip aria-label="Pan and width controls">
      <ChannelStripHeader>Pan / Width</ChannelStripHeader>
      <ChannelStripContent layout="row">
        <ChannelStripSection>
          <ChannelStripLabel id={panLabelId}>Pan</ChannelStripLabel>
          <Knob
            anchor={0}
            aria-describedby={panValueId}
            aria-labelledby={panLabelId}
            id={panId}
            max={100}
            min={-100}
            onValueChange={setPan}
            size="lg"
            value={pan}
          />
          <ChannelStripValue id={panValueId}>
            {formatPan(pan)}
          </ChannelStripValue>
        </ChannelStripSection>
        <ChannelStripSection>
          <ChannelStripLabel id={widthLabelId}>Width</ChannelStripLabel>
          <Knob
            anchor={0}
            aria-describedby={widthValueId}
            aria-labelledby={widthLabelId}
            id={widthId}
            max={100}
            min={-100}
            onValueChange={setWidth}
            size="lg"
            value={width}
          />
          <ChannelStripValue id={widthValueId}>
            {formatSigned(width)}
          </ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}
