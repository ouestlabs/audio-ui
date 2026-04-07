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
import { Fader } from "@/registry/default/ui/audio/elements/fader";

export default function BlockChannelStrip() {
  const volumeId = useId();
  const [volume, setVolume] = useState(72);

  return (
    <ChannelStrip aria-label="Channel 1 strip">
      <ChannelStripHeader>Channel 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel>Volume</ChannelStripLabel>
          <Fader
            aria-label="Volume"
            id={volumeId}
            max={100}
            min={0}
            onValueChange={setVolume}
            value={volume}
          />
          <ChannelStripValue>{`${volume}%`}</ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}
