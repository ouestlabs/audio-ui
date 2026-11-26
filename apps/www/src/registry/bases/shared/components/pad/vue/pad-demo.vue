<script lang="ts" setup>
import Pad from "@/registry/bases/shared/audio-ui/elements/vue/Pad.vue";
import PadItem from "@/registry/bases/shared/audio-ui/elements/vue/PadItem.vue";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry/lib/drums/drum-synthesis";
import { webAudio } from "@/registry/lib/web-audio";

const VOLUME = 0.7;
/** How long the open hat rings, in seconds, unless the closed one chokes it. */
const OPEN_HAT_DECAY = 0.6;
/** How fast a choked sound fades out, as a time constant in seconds. */
const CHOKE_FADE = 0.01;

const PADS = [
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
    trigger: (ctx: AudioContext, destination: AudioNode, time: number) =>
      triggerHihat(ctx, destination, time, { decay: OPEN_HAT_DECAY }),
    value: "open-hat",
  },
];

// The hits each pad still has ringing, so a choke can silence them.
const ringing = new Map<string, GainNode[]>();

/** Each hit goes through a gain of its own: how hard the pad was struck. */
function strike(value: string, details: { velocity: number }) {
  const ctx = webAudio.resume();
  const pad = PADS.find((item) => item.value === value);
  if (!(ctx && pad)) {
    return;
  }
  const hit = ctx.createGain();
  hit.gain.value = details.velocity * VOLUME;
  hit.connect(ctx.destination);
  pad.trigger(ctx, hit, ctx.currentTime);
  if (pad.chokeGroup) {
    ringing.set(value, [...(ringing.get(value) ?? []), hit]);
  }
}

/** Drum hits ring on after the pad is released: only a choke stops them. */
function choke(value: string, details: { reason: string }) {
  const ctx = webAudio.resume();
  if (!ctx || details.reason !== "choke") {
    return;
  }
  for (const hit of ringing.get(value) ?? []) {
    hit.gain.setTargetAtTime(0, ctx.currentTime, CHOKE_FADE);
  }
  ringing.delete(value);
}
</script>

<template>
  <Pad
    aria-label="Drum pads"
    style="max-width: 14rem"
    :columns="2"
    @pad-off="choke"
    @pad-on="strike"
  >
    <PadItem
      v-for="pad in PADS"
      :key="pad.value"
      :choke-group="pad.chokeGroup"
      :value="pad.value"
    >
      {{ pad.label }}
    </PadItem>
  </Pad>
</template>
