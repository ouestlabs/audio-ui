"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import { Lcd } from "@/registry-audio/bases/base/audio/elements/lcd";
import { Led } from "@/registry-audio/bases/base/audio/elements/led";
import { ParameterField } from "@/registry-audio/bases/base/audio/elements/parameter-field";
import { RockerSwitch } from "@/registry-audio/bases/base/audio/elements/rocker-switch";
import { ValueDisplay } from "@/registry-audio/bases/base/audio/elements/value-display";
import { WaveformSelect } from "@/registry-audio/bases/base/audio/elements/waveform-select";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const WAVEFORMS = [
  { label: "Sine", value: "sine" },
  { label: "Triangle", value: "triangle" },
  { label: "Sawtooth", value: "sawtooth" },
  { label: "Square", value: "square" },
] as const;

/** The arpeggio, in semitones from C3: a minor seventh up and down. */
const STEPS = [0, 3, 7, 10, 12, 10, 7, 3] as const;
const ROOT = 48;
const SIGNED: Intl.NumberFormatOptions = { signDisplay: "exceptZero" };
/** How far ahead notes are scheduled, and how often the scheduler wakes, in seconds. */
const LOOKAHEAD = 0.1;
const TICK_MS = 25;

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** Which value the screen shows: the last one touched. */
type Shown = "cutoff" | "gain" | "resonance" | "tempo" | "transpose";

/**
 * A small synth's panel, every control of the audio set in one place: Power
 * plays an arpeggio at the tempo, through the oscillator's waveform, a
 * low-pass filter (cutoff and resonance), the gain and the transpose, into the
 * master fader. The screen shows the value last touched; the LED lights on
 * each beat.
 */
export default function BlockSynthPanel() {
  const [power, setPower] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [gain, setGain] = useState(-6);
  const [transpose, setTranspose] = useState(0);
  const [waveform, setWaveform] = useState<string>("sawtooth");
  const [cutoff, setCutoff] = useState(1800);
  const [resonance, setResonance] = useState(4);
  const [volume, setVolume] = useState(0.7);
  const [shown, setShown] = useState<Shown>("cutoff");
  const [beat, setBeat] = useState(false);
  const master = useMasterBus(volume);

  // What the scheduler reads as it goes, without restarting it.
  const live = useRef({ bpm, transpose, waveform });
  live.current = { bpm, transpose, waveform };
  const chain = useRef<{ filter: BiquadFilterNode; level: GainNode } | null>(
    null
  );

  // The filter and the gain stage, made once the master bus is there.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const filter = ctx.createBiquadFilter();
    const level = ctx.createGain();
    filter.type = "lowpass";
    filter.connect(level).connect(master);
    chain.current = { filter, level };
    return () => {
      level.disconnect();
      filter.disconnect();
      chain.current = null;
    };
  }, [master]);

  useEffect(() => {
    const ctx = webAudio.getContext();
    const nodes = chain.current;
    if (!(ctx && nodes)) {
      return;
    }
    nodes.filter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.01);
    nodes.filter.Q.setTargetAtTime(resonance, ctx.currentTime, 0.01);
    nodes.level.gain.setTargetAtTime(10 ** (gain / 20), ctx.currentTime, 0.01);
  }, [cutoff, gain, resonance]);

  // The arpeggio, sixteenth notes at the tempo, scheduled a little ahead on the audio clock.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(power && ctx && chain.current)) {
      return;
    }
    if (ctx.state !== "running") {
      ctx.resume();
    }
    let step = 0;
    let next = ctx.currentTime + 0.05;
    const playNote = (at: number, note: number) => {
      const nodes = chain.current;
      if (!nodes) {
        return;
      }
      const length = 60 / live.current.bpm / 4;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = live.current.waveform as OscillatorType;
      oscillator.frequency.value = hz(note);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(0.25, at + 0.005);
      envelope.gain.setTargetAtTime(0, at + length * 0.6, 0.03);
      oscillator.connect(envelope).connect(nodes.filter);
      oscillator.start(at);
      oscillator.stop(at + length + 0.2);
    };
    const timer = setInterval(() => {
      while (next < ctx.currentTime + LOOKAHEAD) {
        const index = step % STEPS.length;
        playNote(next, ROOT + (STEPS[index] ?? 0) + live.current.transpose);
        if (index % 4 === 0) {
          const delay = Math.max(0, (next - ctx.currentTime) * 1000);
          setTimeout(() => setBeat(true), delay);
          setTimeout(() => setBeat(false), delay + 90);
        }
        next += 60 / live.current.bpm / 4;
        step += 1;
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      setBeat(false);
    };
  }, [power]);

  const showTempo = useCallback((value: number) => {
    setBpm(value);
    setShown("tempo");
  }, []);
  const showGain = useCallback((value: number) => {
    setGain(value);
    setShown("gain");
  }, []);
  const showTranspose = useCallback((value: number) => {
    setTranspose(value);
    setShown("transpose");
  }, []);
  const showCutoff = useCallback((value: number) => {
    setCutoff(value);
    setShown("cutoff");
  }, []);
  const showResonance = useCallback((value: number) => {
    setResonance(value);
    setShown("resonance");
  }, []);
  const setMaster = useCallback(
    (value: number | readonly number[]) =>
      setVolume(Array.isArray(value) ? (value[0] ?? 0) : Number(value)),
    []
  );

  const reading = {
    cutoff: <ValueDisplay kind="hz" size="lg" value={cutoff} />,
    gain: <ValueDisplay kind="db" size="lg" value={gain} />,
    resonance: (
      <span className="font-medium text-2xl">Q {resonance.toFixed(1)}</span>
    ),
    tempo: <ValueDisplay kind="bpm" size="lg" value={bpm} />,
    transpose: <ValueDisplay kind="semitones" size="lg" value={transpose} />,
  }[shown];

  return (
    <div className="flex w-full max-w-2xl flex-wrap items-stretch gap-4 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-col items-center gap-2">
        <Led label="Beat" on={beat && power} />
        <RockerSwitch
          aria-label="Power"
          checked={power}
          onCheckedChange={setPower}
        />
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          Power
        </span>
      </div>
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Lcd className="w-full" label={shown} live>
          {reading}
        </Lcd>
        <ParameterField
          label="Tempo"
          max={240}
          min={40}
          onValueChange={showTempo}
          precision={2}
          size="sm"
          unit="BPM"
          value={bpm}
        />
        <ParameterField
          format={SIGNED}
          label="Gain"
          max={6}
          min={-36}
          onValueChange={showGain}
          precision={1}
          size="sm"
          step={0.1}
          unit="dB"
          value={gain}
        />
        <ParameterField
          format={SIGNED}
          label="Transpose"
          max={24}
          min={-24}
          onValueChange={showTranspose}
          scrub="vertical"
          size="sm"
          unit="st"
          value={transpose}
        />
      </div>
      <div className="flex flex-col items-center justify-between gap-3">
        <WaveformSelect
          aria-label="Oscillator waveform"
          onValueChange={setWaveform}
          options={WAVEFORMS}
          value={waveform}
        />
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1">
            <Knob
              aria-label="Cutoff"
              max={20_000}
              min={40}
              onValueChange={showCutoff}
              scale="log"
              step={1}
              value={cutoff}
              valueLabel="hidden"
            />
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Cutoff
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Knob
              aria-label="Resonance"
              max={20}
              min={0.5}
              onValueChange={showResonance}
              step={0.1}
              value={resonance}
              valueLabel="hidden"
            />
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Reso
            </span>
          </div>
        </div>
      </div>
      <div className="flex h-44 flex-col items-center gap-1">
        <Fader
          aria-label="Master volume"
          max={1}
          min={0}
          onValueChange={setMaster}
          step={0.01}
          value={volume}
        />
        <span className="text-muted-foreground text-xs uppercase tracking-wide">
          Master
        </span>
      </div>
    </div>
  );
}
