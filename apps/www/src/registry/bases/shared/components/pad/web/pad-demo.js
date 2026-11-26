import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry/lib/drums/drum-synthesis";
import { webAudio } from "@/registry/lib/web-audio";
import "@/registry/primitives/pad/web";

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
    trigger: (ctx, destination, time) =>
      triggerHihat(ctx, destination, time, { decay: OPEN_HAT_DECAY }),
    value: "open-hat",
  },
];

// The hits each pad still has ringing, so a choke can silence them.
const ringing = new Map();

/** Each hit goes through a gain of its own: how hard the pad was struck. */
function strike(value, details) {
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
function choke(value, details) {
  const ctx = webAudio.resume();
  if (!ctx || details.reason !== "choke") {
    return;
  }
  for (const hit of ringing.get(value) ?? []) {
    hit.gain.setTargetAtTime(0, ctx.currentTime, CHOKE_FADE);
  }
  ringing.delete(value);
}

/** Draws the pads into `element`, and returns what takes them away. */
export default function padWebDemo(element) {
  element.innerHTML = `
    <audio-ui-pad aria-label="Drum pads" columns="2" style="--pad-columns: 2; max-width: 14rem">
      ${PADS.map(
        (pad) =>
          `<audio-ui-pad-item ${pad.chokeGroup ? `choke-group="${pad.chokeGroup}"` : ""} value="${pad.value}"><button>${pad.label}</button></audio-ui-pad-item>`
      ).join("")}
    </audio-ui-pad>`;
  const grid = element.querySelector("audio-ui-pad");
  const on = (event) => {
    const { value, velocity } = event.detail;
    strike(value, { velocity });
  };
  const off = (event) => {
    const { value, reason } = event.detail;
    choke(value, { reason });
  };
  grid?.addEventListener("padon", on);
  grid?.addEventListener("padoff", off);
  return () => {
    grid?.removeEventListener("padon", on);
    grid?.removeEventListener("padoff", off);
    element.innerHTML = "";
  };
}
