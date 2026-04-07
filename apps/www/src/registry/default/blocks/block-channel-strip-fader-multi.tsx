"use client";

import { useId, useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripFooter,
  ChannelStripHeader,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/default/ui/audio/elements/channel-strip";
import { Fader } from "@/registry/default/ui/audio/elements/fader";

const channels = ["CH1", "CH2", "CH3", "CH4"] as const;

function ChannelFaderStrip({ label }: { label: string }) {
  const faderId = useId();
  const labelId = useId();
  const valueId = useId();
  const [value, setValue] = useState(50);

  return (
    <ChannelStrip aria-labelledby={labelId}>
      <ChannelStripHeader id={labelId}>{label}</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <Fader
            aria-describedby={valueId}
            aria-labelledby={labelId}
            id={faderId}
            max={100}
            min={0}
            onValueChange={setValue}
            step={1}
            value={value}
          />
          <ChannelStripValue id={valueId}>{value}%</ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}

export default function BlockChannelStripFaderMulti() {
  return (
    <section className="flex gap-3">
      {channels.map((channel) => (
        <ChannelFaderStrip key={channel} label={channel} />
      ))}
    </section>
  );
}
