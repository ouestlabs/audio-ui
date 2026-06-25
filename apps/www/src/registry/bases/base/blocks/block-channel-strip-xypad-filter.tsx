"use client";

import { useState } from "react";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripFooter,
  ChannelStripHeader,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/bases/base/ui/audio/elements/channel-strip";
import { XYPad } from "@/registry/bases/base/ui/audio/elements/xypad";

export default function BlockChannelStripXypadFilter() {
  const [pad, setPad] = useState({ x: 30, y: 70 });

  return (
    <ChannelStrip aria-label="Channel strip with XY filter">
      <ChannelStripHeader>Channel 1</ChannelStripHeader>
      <ChannelStripContent>
        <ChannelStripSection>
          <ChannelStripLabel>Filter</ChannelStripLabel>
          <XYPad
            className="aspect-square"
            defaultValue={pad}
            formatValue={(next) => `Cut ${next.x} | Res ${next.y}`}
            maxX={100}
            maxY={100}
            minX={0}
            minY={0}
            onValueChange={setPad}
            size="sm"
            stepX={1}
            stepY={1}
            value={pad}
            valueDisplay="hidden"
          />
          <ChannelStripValue>
            Cut {pad.x}% · Res {pad.y}%
          </ChannelStripValue>
        </ChannelStripSection>
      </ChannelStripContent>
      <ChannelStripFooter>Output</ChannelStripFooter>
    </ChannelStrip>
  );
}
