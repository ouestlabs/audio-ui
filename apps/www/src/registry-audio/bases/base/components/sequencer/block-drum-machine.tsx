"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/bases/base/ui/input-group";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Sequencer } from "@/registry-audio/bases/base/audio/elements/sequencer";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useStepClock } from "@/registry-audio/bases/base/hooks/use-step-clock";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import {
  triggerHihat,
  triggerKick,
  triggerSnare,
} from "@/registry-audio/bases/base/lib/drum-synthesis";

const STEPS = 16;
const KICK_ROW = 0;
const SNARE_ROW = 1;
const HIHAT_ROW = 2;
const MIN_BPM = 60;
const MAX_BPM = 200;
const DEFAULT_BPM = 120;
const DEFAULT_VOLUME = 0.7;

function clampBpm(value: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value));
}

/** A classic four-on-the-floor starter pattern, syncopated hihats. */
const INITIAL_PATTERN: boolean[][] = [
  [
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ],
  [
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ],
  [
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
  ],
];

export default function BlockDrumMachine() {
  const webAudio = useWebAudio();
  const bpmId = useId();
  const bpmLabelId = useId();
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();

  const [pattern, setPattern] = useState(INITIAL_PATTERN);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [bpmDraft, setBpmDraft] = useState(String(DEFAULT_BPM));
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const masterBus = useMasterBus(volume);

  const handleStep = useCallback(
    (stepIndex: number, time: number) => {
      const ctx = webAudio.getContext();
      if (!(ctx && masterBus)) {
        return;
      }
      if (pattern[KICK_ROW]?.[stepIndex]) {
        triggerKick(ctx, masterBus, time);
      }
      if (pattern[SNARE_ROW]?.[stepIndex]) {
        triggerSnare(ctx, masterBus, time);
      }
      if (pattern[HIHAT_ROW]?.[stepIndex]) {
        triggerHihat(ctx, masterBus, time);
      }
    },
    [masterBus, pattern, webAudio]
  );

  const { isPlaying, start, step, stop } = useStepClock({
    bpm,
    onStep: handleStep,
    totalSteps: STEPS,
  });

  const handleBpmInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBpmDraft(e.target.value);
    },
    []
  );

  const commitBpmDraft = useCallback(() => {
    const parsed = Number(bpmDraft);
    setBpm(Number.isNaN(parsed) ? bpm : clampBpm(parsed));
  }, [bpmDraft, bpm]);

  const handleBpmInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    []
  );

  const handleBpmDecrement = useCallback(() => {
    setBpm((value) => clampBpm(value - 1));
  }, []);

  const handleBpmIncrement = useCallback(() => {
    setBpm((value) => clampBpm(value + 1));
  }, []);

  useEffect(() => {
    setBpmDraft(String(bpm));
  }, [bpm]);

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
      <Sequencer
        activeStep={isPlaying ? step : undefined}
        aria-label="Drum pattern — kick, snare, hihat"
        onValueChange={setPattern}
        value={pattern}
      />
      <div className="flex flex-row items-center justify-between gap-4">
        <Button
          onClick={isPlaying ? stop : start}
          size="sm"
          type="button"
          variant="outline"
        >
          {isPlaying ? "Stop" : "Play"}
        </Button>
        <ChannelStrip aria-label="Tempo" orientation="horizontal">
          <ChannelStripContent>
            <ChannelStripSection>
              <ChannelStripLabel id={bpmLabelId}>BPM</ChannelStripLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupButton
                    aria-label="Decrease BPM"
                    onClick={handleBpmDecrement}
                    size="icon-xs"
                  >
                    <IconPlaceholder
                      className="size-4"
                      hugeicons="MinusSignIcon"
                      lucide="Minus"
                      phosphor="MinusIcon"
                      remixicon="RiSubtractLine"
                      tabler="IconMinus"
                    />
                  </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput
                  aria-labelledby={bpmLabelId}
                  className="[appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  id={bpmId}
                  inputMode="numeric"
                  max={MAX_BPM}
                  min={MIN_BPM}
                  onBlur={commitBpmDraft}
                  onChange={handleBpmInputChange}
                  onKeyDown={handleBpmInputKeyDown}
                  step={1}
                  type="number"
                  value={bpmDraft}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Increase BPM"
                    onClick={handleBpmIncrement}
                    size="icon-xs"
                  >
                    <IconPlaceholder
                      className="size-4"
                      hugeicons="PlusSignIcon"
                      lucide="Plus"
                      phosphor="PlusIcon"
                      remixicon="RiAddLine"
                      tabler="IconPlus"
                    />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </ChannelStripSection>
          </ChannelStripContent>
        </ChannelStrip>
      </div>
      <ChannelStrip aria-label="Volume" orientation="horizontal">
        <ChannelStripContent>
          <ChannelStripSection>
            <ChannelStripLabel id={volumeLabelId}>Volume</ChannelStripLabel>
            <Fader
              aria-describedby={volumeValueId}
              aria-labelledby={volumeLabelId}
              id={volumeId}
              max={1}
              min={0}
              onValueChange={setVolume}
              orientation="horizontal"
              step={0.01}
              value={volume}
              valueLabel="hidden"
            />
            <ChannelStripValue id={volumeValueId}>
              {Math.round(volume * 100)}%
            </ChannelStripValue>
          </ChannelStripSection>
        </ChannelStripContent>
      </ChannelStrip>
    </div>
  );
}
