"use client";

import * as React from "react";
import { useAudio } from "@/registry/default/hooks/use-audio";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry/default/ui/audio/elements/channel-strip";
import { Fader } from "@/registry/default/ui/audio/elements/fader";
import { Knob } from "@/registry/default/ui/audio/elements/knob";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/default/ui/toggle-group";

type WaveformType = "sine" | "triangle" | "sawtooth" | "square";

export default function BlockWaveShaper() {
  const { webAudio } = useAudio();
  const driveId = React.useId();
  const driveLabelId = React.useId();
  const driveValueId = React.useId();
  const toneId = React.useId();
  const toneLabelId = React.useId();
  const toneValueId = React.useId();
  const detuneId = React.useId();
  const detuneLabelId = React.useId();
  const detuneValueId = React.useId();
  const mixId = React.useId();
  const mixLabelId = React.useId();
  const mixValueId = React.useId();
  const faderId = React.useId();
  const faderLabelId = React.useId();
  const faderValueId = React.useId();
  const [waveform, setWaveform] = React.useState<WaveformType>("sine");
  const [volume, setVolume] = React.useState(0.5);
  const [drive, setDrive] = React.useState(1);
  const [tone, setTone] = React.useState(50);
  const [detune, setDetune] = React.useState(0);
  const [mix, setMix] = React.useState(50);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0.5, y: 0.5 });

  const oscillator1Ref = React.useRef<OscillatorNode | null>(null);
  const oscillator2Ref = React.useRef<OscillatorNode | null>(null);
  const gainNodeRef = React.useRef<GainNode | null>(null);
  const dryGainRef = React.useRef<GainNode | null>(null);
  const wetGainRef = React.useRef<GainNode | null>(null);
  const shaperRef = React.useRef<WaveShaperNode | null>(null);
  const filterRef = React.useRef<BiquadFilterNode | null>(null);

  const getFrequency = React.useCallback((x: number) => {
    const minFreq = 55;
    const maxFreq = 880;
    return minFreq * (maxFreq / minFreq) ** x;
  }, []);

  const getResonance = React.useCallback((y: number) => 0.5 + y * 15, []);

  const makeDistortionCurve = React.useCallback((amount: number) => {
    const samples = 44_100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }, []);

  const startSound = React.useCallback(
    (x: number, y: number) => {
      const ctx = webAudio.getContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      const frequency = getFrequency(x);
      const resonance = getResonance(y);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = waveform;
      osc2.type = waveform;
      osc1.frequency.setValueAtTime(frequency, now);
      osc2.frequency.setValueAtTime(frequency, now);
      osc2.detune.setValueAtTime(detune, now);

      const oscGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const mainGain = ctx.createGain();

      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(drive);
      shaper.oversample = "4x";

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(500 + tone * 75, now);
      filter.Q.setValueAtTime(resonance, now);

      const dryLevel = (100 - mix) / 100;
      const wetLevel = mix / 100;

      oscGain.gain.setValueAtTime(0.5, now);
      dryGain.gain.setValueAtTime(dryLevel, now);
      wetGain.gain.setValueAtTime(wetLevel, now);
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.02);

      osc1.connect(oscGain);
      osc2.connect(oscGain);

      oscGain.connect(dryGain);

      oscGain.connect(shaper);
      shaper.connect(wetGain);

      dryGain.connect(filter);
      wetGain.connect(filter);
      filter.connect(mainGain);
      mainGain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      oscillator1Ref.current = osc1;
      oscillator2Ref.current = osc2;
      gainNodeRef.current = mainGain;
      dryGainRef.current = dryGain;
      wetGainRef.current = wetGain;
      shaperRef.current = shaper;
      filterRef.current = filter;
      setIsPlaying(true);
    },
    [
      detune,
      drive,
      getFrequency,
      getResonance,
      makeDistortionCurve,
      mix,
      tone,
      volume,
      waveform,
      webAudio,
    ]
  );

  const stopSound = React.useCallback(() => {
    const ctx = webAudio.getContext();
    if (
      !(
        ctx &&
        gainNodeRef.current &&
        oscillator1Ref.current &&
        oscillator2Ref.current
      )
    ) {
      return;
    }

    const now = ctx.currentTime;
    gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.05);

    const osc1 = oscillator1Ref.current;
    const osc2 = oscillator2Ref.current;

    setTimeout(() => {
      osc1.stop();
      osc1.disconnect();
      osc2.stop();
      osc2.disconnect();
    }, 60);

    oscillator1Ref.current = null;
    oscillator2Ref.current = null;
    gainNodeRef.current = null;
    dryGainRef.current = null;
    wetGainRef.current = null;
    shaperRef.current = null;
    filterRef.current = null;
    setIsPlaying(false);
  }, [webAudio]);

  const updateSound = React.useCallback(
    (x: number, y: number) => {
      const ctx = webAudio.getContext();
      if (
        !(
          ctx &&
          oscillator1Ref.current &&
          oscillator2Ref.current &&
          filterRef.current
        )
      ) {
        return;
      }

      const now = ctx.currentTime;
      const frequency = getFrequency(x);
      const resonance = getResonance(y);

      oscillator1Ref.current.frequency.setTargetAtTime(frequency, now, 0.01);
      oscillator2Ref.current.frequency.setTargetAtTime(frequency, now, 0.01);
      filterRef.current.Q.setTargetAtTime(resonance, now, 0.01);
    },
    [getFrequency, getResonance, webAudio]
  );

  React.useEffect(() => {
    if (oscillator1Ref.current && oscillator2Ref.current) {
      oscillator1Ref.current.type = waveform;
      oscillator2Ref.current.type = waveform;
    }
  }, [waveform]);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (oscillator2Ref.current && ctx) {
      oscillator2Ref.current.detune.setTargetAtTime(
        detune,
        ctx.currentTime,
        0.01
      );
    }
  }, [detune, webAudio]);

  React.useEffect(() => {
    if (shaperRef.current) {
      shaperRef.current.curve = makeDistortionCurve(drive);
    }
  }, [drive, makeDistortionCurve]);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (filterRef.current && ctx) {
      const now = ctx.currentTime;
      filterRef.current.frequency.setTargetAtTime(500 + tone * 75, now, 0.01);
    }
  }, [tone, webAudio]);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (dryGainRef.current && wetGainRef.current && ctx) {
      const now = ctx.currentTime;
      const dryLevel = (100 - mix) / 100;
      const wetLevel = mix / 100;
      dryGainRef.current.gain.setTargetAtTime(dryLevel, now, 0.01);
      wetGainRef.current.gain.setTargetAtTime(wetLevel, now, 0.01);
    }
  }, [mix, webAudio]);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (gainNodeRef.current && ctx) {
      gainNodeRef.current.gain.setTargetAtTime(
        volume * 0.4,
        ctx.currentTime,
        0.01
      );
    }
  }, [volume, webAudio]);

  React.useEffect(
    () => () => {
      if (oscillator1Ref.current) {
        oscillator1Ref.current.stop();
        oscillator1Ref.current.disconnect();
      }
      if (oscillator2Ref.current) {
        oscillator2Ref.current.stop();
        oscillator2Ref.current.disconnect();
      }
    },
    []
  );

  const formatValue = React.useCallback(
    (val: { x: number; y: number }) => {
      const x = val.x / 100;
      const y = val.y / 100;
      const freq = Math.round(getFrequency(x));
      const res = getResonance(y).toFixed(1);
      return (
        <>
          <span>{freq}Hz</span>
          <span>, Q: {res}</span>
        </>
      );
    },
    [getFrequency, getResonance]
  );

  const waveformOptions: {
    icon: React.ReactNode;
    label: string;
    value: WaveformType;
  }[] = [
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Sine wave</title>
          <path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0" />
        </svg>
      ),
      label: "Sine wave",
      value: "sine",
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Triangle wave</title>
          <path d="M2 12l5-6 5 12 5-12 5 6" />
        </svg>
      ),
      label: "Triangle wave",
      value: "triangle",
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Sawtooth wave</title>
          <path d="M2 18l8-12v12l8-12v12" />
        </svg>
      ),
      label: "Sawtooth wave",
      value: "sawtooth",
    },
    {
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Square wave</title>
          <path d="M2 18h4V6h6v12h4V6h6" />
        </svg>
      ),
      label: "Square wave",
      value: "square",
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 rounded-4xl border bg-card p-4">
      <XYPad
        formatValue={formatValue}
        maxX={100}
        maxY={100}
        minX={0}
        minY={0}
        onValueChange={(val) => {
          const normalizedX = val.x / 100;
          const normalizedY = val.y / 100;
          setPosition({ x: normalizedX, y: normalizedY });
          if (isPlaying) {
            updateSound(normalizedX, normalizedY);
          } else {
            startSound(normalizedX, normalizedY);
          }
        }}
        onValueCommit={() => {
          stopSound();
        }}
        value={{ x: position.x * 100, y: position.y * 100 }}
      />
      <ToggleGroup
        className="w-full"
        onValueChange={(values) => {
          const next = values.at(-1);
          if (next) {
            setWaveform(next as WaveformType);
          }
        }}
        size="sm"
        value={[waveform]}
        variant="outline"
      >
        {waveformOptions.map(({ icon, label, value }) => (
          <ToggleGroupItem
            aria-label={label}
            className="flex-1"
            key={value}
            value={value}
          >
            {icon}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ChannelStrip aria-label="Shaper controls" className="w-full">
        <ChannelStripContent layout="row">
          <ChannelStripSection>
            <ChannelStripLabel id={driveLabelId}>Drive</ChannelStripLabel>
            <Knob
              aria-describedby={driveValueId}
              aria-labelledby={driveLabelId}
              defaultValue={1}
              id={driveId}
              max={100}
              min={0}
              onValueChange={setDrive}
              size="sm"
              step={1}
            />
            <ChannelStripValue id={driveValueId}>{drive}</ChannelStripValue>
          </ChannelStripSection>
          <ChannelStripSection>
            <ChannelStripLabel id={toneLabelId}>Tone</ChannelStripLabel>
            <Knob
              aria-describedby={toneValueId}
              aria-labelledby={toneLabelId}
              defaultValue={50}
              id={toneId}
              max={100}
              min={0}
              onValueChange={setTone}
              size="sm"
              step={1}
            />
            <ChannelStripValue id={toneValueId}>{tone}</ChannelStripValue>
          </ChannelStripSection>
          <ChannelStripSection>
            <ChannelStripLabel id={detuneLabelId}>Detune</ChannelStripLabel>
            <Knob
              anchor={0}
              aria-describedby={detuneValueId}
              aria-labelledby={detuneLabelId}
              defaultValue={0}
              id={detuneId}
              max={50}
              min={-50}
              onValueChange={setDetune}
              size="sm"
              step={1}
            />
            <ChannelStripValue id={detuneValueId}>
              {detune > 0 ? "+" : ""}
              {detune}
            </ChannelStripValue>
          </ChannelStripSection>
          <ChannelStripSection>
            <ChannelStripLabel id={mixLabelId}>Mix</ChannelStripLabel>
            <Knob
              aria-describedby={mixValueId}
              aria-labelledby={mixLabelId}
              defaultValue={50}
              id={mixId}
              max={100}
              min={0}
              onValueChange={setMix}
              size="sm"
              step={1}
            />
            <ChannelStripValue id={mixValueId}>{mix}%</ChannelStripValue>
          </ChannelStripSection>
        </ChannelStripContent>
      </ChannelStrip>
      <ChannelStrip aria-label="Volume" orientation="horizontal">
        <ChannelStripContent>
          <ChannelStripSection>
            <ChannelStripLabel id={faderLabelId}>Volume</ChannelStripLabel>
            <Fader
              aria-describedby={faderValueId}
              aria-labelledby={faderLabelId}
              id={faderId}
              max={1}
              min={0}
              onValueChange={setVolume}
              step={0.01}
              value={volume}
            />
            <ChannelStripValue id={faderValueId}>
              {Math.round(volume * 100)}%
            </ChannelStripValue>
          </ChannelStripSection>
        </ChannelStripContent>
      </ChannelStrip>
    </div>
  );
}
