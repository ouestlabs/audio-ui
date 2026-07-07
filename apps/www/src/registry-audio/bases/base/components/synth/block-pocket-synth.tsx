"use client";

import * as React from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { XYPad } from "@/registry-audio/bases/base/audio/elements/xypad";
import { useAudio } from "@/registry-audio/bases/base/hooks/use-audio";

type WaveformType = "sine" | "triangle" | "sawtooth" | "square";
type FilterType = "lowpass" | "highpass" | "bandpass" | "allpass";

export default function BlockPocketSynth() {
  const { webAudio } = useAudio();
  const faderId = React.useId();
  const faderLabelId = React.useId();
  const faderValueId = React.useId();
  const [waveform, setWaveform] = React.useState<WaveformType>("square");
  const [filterType, setFilterType] = React.useState<FilterType>("allpass");
  const [volume, setVolume] = React.useState(0.5);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0.5, y: 0.5 });

  const oscillatorRef = React.useRef<OscillatorNode | null>(null);
  const gainNodeRef = React.useRef<GainNode | null>(null);
  const filterNodeRef = React.useRef<BiquadFilterNode | null>(null);

  const getFrequency = React.useCallback((x: number) => {
    const minFreq = 30;
    const maxFreq = 1046;
    return minFreq * (maxFreq / minFreq) ** x;
  }, []);

  const getFilterCutoff = React.useCallback((y: number) => {
    const minCutoff = 200;
    const maxCutoff = 8000;
    return minCutoff * (maxCutoff / minCutoff) ** y;
  }, []);

  const startSound = React.useCallback(
    (x: number, y: number) => {
      const ctx = webAudio.getContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(getFrequency(x), now);
      filterNode.type = filterType;
      filterNode.frequency.setValueAtTime(getFilterCutoff(y), now);
      filterNode.Q.setValueAtTime(5, now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.02);

      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      filterNodeRef.current = filterNode;
      setIsPlaying(true);
    },
    [filterType, getFilterCutoff, getFrequency, webAudio, volume, waveform]
  );

  const stopSound = React.useCallback(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && gainNodeRef.current && oscillatorRef.current)) {
      return;
    }

    const now = ctx.currentTime;
    gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.05);
    const osc = oscillatorRef.current;
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
    }, 60);

    oscillatorRef.current = null;
    gainNodeRef.current = null;
    filterNodeRef.current = null;
    setIsPlaying(false);
  }, [webAudio]);

  const updateSound = React.useCallback(
    (x: number, y: number) => {
      const ctx = webAudio.getContext();
      if (!(ctx && oscillatorRef.current && filterNodeRef.current)) {
        return;
      }

      const now = ctx.currentTime;
      oscillatorRef.current.frequency.setTargetAtTime(
        getFrequency(x),
        now,
        0.01
      );
      filterNodeRef.current.frequency.setTargetAtTime(
        getFilterCutoff(y),
        now,
        0.01
      );
    },
    [getFilterCutoff, getFrequency, webAudio]
  );

  React.useEffect(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.type = waveform;
    }
  }, [waveform]);

  React.useEffect(() => {
    if (filterNodeRef.current) {
      filterNodeRef.current.type = filterType;
    }
  }, [filterType]);

  React.useEffect(() => {
    const ctx = webAudio.getContext();
    if (gainNodeRef.current && ctx) {
      gainNodeRef.current.gain.setTargetAtTime(
        volume * 0.3,
        ctx.currentTime,
        0.01
      );
    }
  }, [volume, webAudio]);

  React.useEffect(
    () => () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      }
    },
    []
  );

  const formatValue = React.useCallback(
    (val: { x: number; y: number }) => {
      const x = val.x / 100;
      const y = val.y / 100;
      return (
        <>
          <span>{Math.round(getFrequency(x))}Hz</span>
          <span>, </span>
          <span>{Math.round(getFilterCutoff(y))}Hz</span>
        </>
      );
    },
    [getFilterCutoff, getFrequency]
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

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: "Allpass", value: "allpass" },
    { label: "Lowpass", value: "lowpass" },
    { label: "Highpass", value: "highpass" },
    { label: "Bandpass", value: "bandpass" },
  ];

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
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
        onValueCommit={() => stopSound()}
        value={{ x: position.x * 100, y: position.y * 100 }}
      />
      <ToggleGroup
        className="w-full"
        onValueChange={(values) => setWaveform(values[0] as WaveformType)}
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
      <ToggleGroup
        className="w-full"
        onValueChange={(values) => setFilterType(values[0] as FilterType)}
        size="sm"
        value={[filterType]}
        variant="outline"
      >
        {filterOptions.map(({ label, value }) => (
          <ToggleGroupItem
            aria-label={label}
            className="flex-1"
            key={value}
            value={value}
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
