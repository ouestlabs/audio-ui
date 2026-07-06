"use client";

import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripFooter,
  ChannelStripHeader,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";

export default function BlockChannelStripTransportVertical() {
  return (
    <ChannelStrip aria-label="Transport">
      <ChannelStripHeader>Track 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <Transport
            aria-label="Seek"
            bufferedValue={62}
            onSeek={() => {
              //
            }}
            value={35}
          />
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>
        <ChannelStripValue>0:35 / 1:42</ChannelStripValue>
      </ChannelStripFooter>
    </ChannelStrip>
  );
}
