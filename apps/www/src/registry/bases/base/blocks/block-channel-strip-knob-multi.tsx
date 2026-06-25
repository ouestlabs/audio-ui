"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripFooter,
  ChannelStripHeader,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/bases/base/ui/audio/elements/channel-strip";
import { Knob } from "@/registry/bases/base/ui/audio/elements/knob";

const effects = ["Gain", "Reverb", "Delay", "Drive"] as const;

function EffectStrip({ label }: { label: string }) {
  const knobId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(50);

  return (
    <ChannelStrip aria-labelledby={labelId}>
      <ChannelStripHeader id={labelId}>{label}</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <Knob
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={knobId}
            max={100}
            min={0}
            onValueChange={setValue}
            size="lg"
            step={1}
            value={value}
          />
          <ChannelStripValue id={valueId}>{value}%</ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>FX</ChannelStripFooter>
    </ChannelStrip>
  );
}

export default function BlockChannelStripKnobMulti() {
  return (
    <section className="flex gap-3">
      {effects.map((effect) => (
        <EffectStrip key={effect} label={effect} />
      ))}
    </section>
  );
}
