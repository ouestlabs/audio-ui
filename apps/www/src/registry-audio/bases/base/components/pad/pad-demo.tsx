"use client";

import type { Pad as PadPrimitive } from "@audio-ui/react";
import { useCallback, useRef } from "react";
import { Pad, PadItem } from "@/registry-audio/bases/base/audio/elements/pad";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const VOLUME = 0.7;
/** How long the open hat rings, in seconds, unless the closed one chokes it. */
const OPEN_HAT_DECAY = 0.6;
/** How fast a choked sound fades out, as a time constant in seconds. */
const CHOKE_FADE = 0.01;

type Trigger = (
  ctx: AudioContext,
  destination: AudioNode,
  time: number
) => void;

const PADS: {
  chokeGroup?: string;
  label: string;
  trigger: Trigger;
  value: string;
}[] = [
  { label: "Kick", trigger: triggerKick, value: "kick" },
  { label: "Snare", trigger: triggerSnare, value: "snare" },
  {
    chokeGroup: "hat",
    label: "Closed hat",
    trigger: triggerHihat,
    value: "closed-hat",
  },
  {
    chokeGroup: "hat",
    label: "Open hat",
    trigger: (ctx, destination, time) =>
      triggerHihat(ctx, destination, time, { decay: OPEN_HAT_DECAY }),
    value: "open-hat",
  },
];

/** Four drum pads: strike harder near the top. The closed hat cuts the open one short, as on a drum machine. */
export default function PadDemo() {
  const master = useMasterBus(VOLUME);
  // The hits each pad still has ringing, so a choke can silence them.
  const ringing = useRef(new Map<string, GainNode[]>());

  const strike = useCallback(
    (value: string, details: PadPrimitive.Root.OnEventDetails) => {
      const ctx = webAudio.getContext();
      const pad = PADS.find((item) => item.value === value);
      if (!(ctx && master && pad)) {
        return;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Each hit goes through a gain of its own: how hard the pad was struck.
      const hit = ctx.createGain();
      hit.gain.value = details.velocity;
      hit.connect(master);
      pad.trigger(ctx, hit, ctx.currentTime);
      if (pad.chokeGroup) {
        ringing.current.set(value, [
          ...(ringing.current.get(value) ?? []),
          hit,
        ]);
      }
    },
    [master]
  );

  // Drum hits ring on after the pad is released: only a choke stops them.
  const choke = useCallback(
    (value: string, details: PadPrimitive.Root.OffEventDetails) => {
      const ctx = webAudio.getContext();
      if (!ctx || details.reason !== "choke") {
        return;
      }
      for (const hit of ringing.current.get(value) ?? []) {
        hit.gain.setTargetAtTime(0, ctx.currentTime, CHOKE_FADE);
      }
      ringing.current.delete(value);
    },
    []
  );

  return (
    <Pad
      aria-label="Drum pads"
      className="max-w-56"
      columns={2}
      onPadOff={choke}
      onPadOn={strike}
    >
      {PADS.map((pad) => (
        <PadItem chokeGroup={pad.chokeGroup} key={pad.value} value={pad.value}>
          {pad.label}
        </PadItem>
      ))}
    </Pad>
  );
}
