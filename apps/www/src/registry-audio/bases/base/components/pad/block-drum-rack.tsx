"use client";

import type { Pad as PadPrimitive } from "@audio-ui/react";
import { useCallback, useRef, useState } from "react";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Pad, PadItem } from "@/registry-audio/bases/base/audio/elements/pad";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type DrumOptions,
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const VOLUME = 0.7;
/** How fast a choked sound fades out, as a time constant in seconds. */
const CHOKE_FADE = 0.01;

const VOICES = { hat: triggerHihat, kick: triggerKick, snare: triggerSnare };

interface Sound {
  chokeGroup?: string;
  /** Seconds. */
  decay: number;
  id: string;
  label: string;
  /** Gain, from 0 to 1. */
  level: number;
  /** Semitones from the voice's own pitch. */
  tune: number;
  voice: keyof typeof VOICES;
}

/** Sixteen sounds from three voices, four to a row. The hats share a choke group. */
const KIT: Sound[] = [
  { decay: 0.2, id: "kick", label: "Kick", level: 0.9, tune: 0, voice: "kick" },
  { decay: 0.45, id: "sub", label: "Sub", level: 0.8, tune: -5, voice: "kick" },
  {
    decay: 0.15,
    id: "snare",
    label: "Snare",
    level: 0.8,
    tune: 0,
    voice: "snare",
  },
  { decay: 0.04, id: "rim", label: "Rim", level: 0.7, tune: 7, voice: "snare" },
  {
    decay: 0.3,
    id: "low-tom",
    label: "Low tom",
    level: 0.8,
    tune: 7,
    voice: "kick",
  },
  {
    decay: 0.25,
    id: "mid-tom",
    label: "Mid tom",
    level: 0.8,
    tune: 12,
    voice: "kick",
  },
  {
    decay: 0.22,
    id: "clap",
    label: "Clap",
    level: 0.8,
    tune: -3,
    voice: "snare",
  },
  {
    decay: 0.06,
    id: "snap",
    label: "Snap",
    level: 0.7,
    tune: 12,
    voice: "snare",
  },
  {
    chokeGroup: "hat",
    decay: 0.05,
    id: "closed-hat",
    label: "Closed hat",
    level: 0.7,
    tune: 0,
    voice: "hat",
  },
  {
    chokeGroup: "hat",
    decay: 0.03,
    id: "pedal-hat",
    label: "Pedal hat",
    level: 0.6,
    tune: -3,
    voice: "hat",
  },
  {
    chokeGroup: "hat",
    decay: 0.6,
    id: "open-hat",
    label: "Open hat",
    level: 0.6,
    tune: 0,
    voice: "hat",
  },
  {
    decay: 0.09,
    id: "shaker",
    label: "Shaker",
    level: 0.5,
    tune: 5,
    voice: "hat",
  },
  {
    decay: 0.2,
    id: "high-tom",
    label: "High tom",
    level: 0.8,
    tune: 17,
    voice: "kick",
  },
  {
    decay: 0.05,
    id: "perc",
    label: "Perc",
    level: 0.7,
    tune: 24,
    voice: "kick",
  },
  { decay: 1.2, id: "ride", label: "Ride", level: 0.4, tune: -7, voice: "hat" },
  {
    decay: 1.8,
    id: "crash",
    label: "Crash",
    level: 0.45,
    tune: -12,
    voice: "hat",
  },
];

const formatTune = (tune: number) => `${tune > 0 ? "+" : ""}${tune} st`;
const formatDecay = (seconds: number) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;
const formatLevel = (level: number) => `${Math.round(level * 100)}%`;

/**
 * A drum rack: sixteen pads, each its own sound. Strike a pad to play it and
 * select it, then shape it with the knobs: tune, decay and level. Strikes are
 * harder near the top of a pad; the hats cut each other short.
 */
export default function BlockDrumRack() {
  const [kit, setKit] = useState(KIT);
  const kitRef = useRef(kit);
  kitRef.current = kit;
  const [selected, setSelected] = useState(0);
  const master = useMasterBus(VOLUME);
  // The hits each pad still has ringing, so a choke can silence them.
  const ringing = useRef(new Map<string, GainNode[]>());

  const strike = useCallback(
    (id: string, details: PadPrimitive.Root.OnEventDetails) => {
      const ctx = webAudio.getContext();
      const index = kitRef.current.findIndex((item) => item.id === id);
      const sound = kitRef.current[index];
      if (!(ctx && master && sound)) {
        return;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      setSelected(index);
      // Each hit goes through a gain of its own: how hard it was struck, at the pad's level.
      const hit = ctx.createGain();
      hit.gain.value = details.velocity * sound.level;
      hit.connect(master);
      const options: DrumOptions = { decay: sound.decay, tune: sound.tune };
      VOICES[sound.voice](ctx, hit, ctx.currentTime, options);
      if (sound.chokeGroup) {
        ringing.current.set(id, [...(ringing.current.get(id) ?? []), hit]);
      }
    },
    [master]
  );

  // Drum hits ring on after the pad is released: only a choke stops them.
  const choke = useCallback(
    (id: string, details: PadPrimitive.Root.OffEventDetails) => {
      const ctx = webAudio.getContext();
      if (!ctx || details.reason !== "choke") {
        return;
      }
      for (const hit of ringing.current.get(id) ?? []) {
        hit.gain.setTargetAtTime(0, ctx.currentTime, CHOKE_FADE);
      }
      ringing.current.delete(id);
    },
    []
  );

  const edit = useCallback(
    (change: Partial<Pick<Sound, "decay" | "level" | "tune">>) =>
      setKit((current) =>
        current.map((item, index) =>
          index === selected ? { ...item, ...change } : item
        )
      ),
    [selected]
  );
  const setTune = useCallback((tune: number) => edit({ tune }), [edit]);
  const setDecay = useCallback((decay: number) => edit({ decay }), [edit]);
  const setLevel = useCallback((level: number) => edit({ level }), [edit]);

  const sound = kit[selected] ?? KIT[0];
  const factory = KIT[selected] ?? KIT[0];

  return (
    <div className="cn-audio-panel @container/panel w-full min-w-0 border bg-card p-4">
      <div className="mx-auto flex w-full max-w-96 flex-col gap-4 @2xl/panel:max-w-none @2xl/panel:flex-row">
        <section
          aria-label={`${sound.label} settings`}
          className="flex min-w-0 flex-1 flex-col"
        >
          <div className="flex flex-wrap items-start justify-around gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                Tune
              </span>
              <Knob
                anchor={0}
                aria-label={`${sound.label} tune`}
                defaultValue={factory.tune}
                formatValue={formatTune}
                max={12}
                min={-12}
                onValueChange={setTune}
                step={1}
                value={sound.tune}
                valueLabel="always"
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                Decay
              </span>
              <Knob
                aria-label={`${sound.label} decay`}
                defaultValue={factory.decay}
                formatValue={formatDecay}
                max={2}
                min={0.02}
                onValueChange={setDecay}
                scale="log"
                step={0.001}
                value={sound.decay}
                valueLabel="always"
              />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                Level
              </span>
              <Knob
                aria-label={`${sound.label} level`}
                defaultValue={factory.level}
                formatValue={formatLevel}
                max={1}
                min={0}
                onValueChange={setLevel}
                step={0.01}
                value={sound.level}
                valueLabel="always"
              />
            </div>
          </div>
        </section>
        <Pad
          aria-label="Drum rack"
          className="w-full shrink-0 @2xl/panel:w-96"
          columns={4}
          onPadOff={choke}
          onPadOn={strike}
        >
          {kit.map((item, index) => (
            <PadItem
              chokeGroup={item.chokeGroup}
              className="data-[selected]:ring-2 data-[selected]:ring-primary/40"
              data-selected={index === selected ? "" : undefined}
              key={item.id}
              value={item.id}
            >
              {item.label}
            </PadItem>
          ))}
        </Pad>
      </div>
    </div>
  );
}
