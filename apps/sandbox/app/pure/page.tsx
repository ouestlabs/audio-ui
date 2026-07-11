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
} from "@/components/pure/channel-strip";
import { Fader } from "@/components/pure/fader";
import { Knob } from "@/components/pure/knob";
import { Transport } from "@/components/pure/transport";
import { XYPad } from "@/components/pure/xypad";

export default function Pure() {
  const volumeId = useId();
  const [volume, setVolume] = useState(72);
  const [pan, setPan] = useState(50);
  const [filter, setFilter] = useState({ x: 50, y: 50 });
  const [position, setPosition] = useState(35);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 p-8">
      <p className="text-neutral-500 text-xs">
        pure · @audio-ui/react · default headless visual
      </p>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <ChannelStrip aria-label="Volume channel strip">
          <ChannelStripHeader>Volume</ChannelStripHeader>
          <ChannelStripContent>
            <ChannelStripSection>
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
          <ChannelStripFooter>Ch. 1</ChannelStripFooter>
        </ChannelStrip>

        <ChannelStrip aria-label="Pan channel strip">
          <ChannelStripHeader>Pan</ChannelStripHeader>
          <ChannelStripContent>
            <ChannelStripSection>
              <Knob
                aria-label="Pan"
                max={100}
                min={0}
                onValueChange={setPan}
                value={pan}
              />
              <ChannelStripValue>{`${pan}%`}</ChannelStripValue>
            </ChannelStripSection>
          </ChannelStripContent>
          <ChannelStripFooter>Ch. 2</ChannelStripFooter>
        </ChannelStrip>

        <ChannelStrip aria-label="Filter channel strip">
          <ChannelStripHeader>Filter</ChannelStripHeader>
          <ChannelStripContent>
            <ChannelStripSection>
              <XYPad
                aria-label="Filter frequency and resonance"
                onValueChange={setFilter}
                value={filter}
              />
              <ChannelStripLabel>Freq / Reso</ChannelStripLabel>
            </ChannelStripSection>
          </ChannelStripContent>
          <ChannelStripFooter>Ch. 3</ChannelStripFooter>
        </ChannelStrip>
      </div>

      <ChannelStrip aria-label="Transport" orientation="horizontal">
        <ChannelStripHeader>Master</ChannelStripHeader>
        <ChannelStripContent>
          <ChannelStripSection>
            <Transport
              aria-label="Seek"
              bufferedValue={Math.min(position + 15, 100)}
              onSeek={setPosition}
              value={position}
            />
          </ChannelStripSection>
        </ChannelStripContent>
        <ChannelStripFooter>
          <ChannelStripValue>{`${Math.round(position)}%`}</ChannelStripValue>
        </ChannelStripFooter>
      </ChannelStrip>
    </div>
  );
}
