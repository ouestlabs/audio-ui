"use client";

import { useCallback, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { Envelope } from "@/registry-audio/bases/base/audio/elements/envelope";

interface EnvelopePoint {
  x: number;
  y: number;
}

/** Common audio envelope archetypes, not just the classic ADSR shape. */
const PRESETS: Record<string, { label: string; points: EnvelopePoint[] }> = {
  adsr: {
    label: "ADSR",
    points: [
      { x: 0, y: 0.05 },
      { x: 0.15, y: 1 },
      { x: 0.35, y: 0.6 },
      { x: 0.7, y: 0.6 },
      { x: 1, y: 0.05 },
    ],
  },
  bass: {
    label: "Bass",
    points: [
      { x: 0, y: 0 },
      { x: 0.05, y: 1 },
      { x: 0.2, y: 0.4 },
      { x: 0.85, y: 0.35 },
      { x: 1, y: 0 },
    ],
  },
  gate: {
    label: "Gate",
    points: [
      { x: 0, y: 0 },
      { x: 0.02, y: 1 },
      { x: 0.9, y: 1 },
      { x: 1, y: 0 },
    ],
  },
  pad: {
    label: "Pad",
    points: [
      { x: 0, y: 0 },
      { x: 0.4, y: 0.85 },
      { x: 0.6, y: 0.85 },
      { x: 1, y: 0 },
    ],
  },
  pluck: {
    label: "Pluck",
    points: [
      { x: 0, y: 0 },
      { x: 0.03, y: 1 },
      { x: 0.25, y: 0.08 },
      { x: 1, y: 0 },
    ],
  },
};

const PRESET_KEYS = Object.keys(PRESETS);

export default function EnvelopePresetsDemo() {
  const [presetKey, setPresetKey] = useState("adsr");
  const [points, setPoints] = useState(PRESETS.adsr.points);

  const handlePresetClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const key = e.currentTarget.dataset.presetKey;
      const preset = key ? PRESETS[key] : undefined;
      if (!(key && preset)) {
        return;
      }
      setPresetKey(key);
      setPoints(preset.points);
    },
    []
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <Envelope
        aria-label={`${PRESETS[presetKey]?.label ?? "Envelope"} envelope`}
        onValueChange={setPoints}
        value={points}
      />
      <div className="flex flex-wrap justify-center gap-1.5">
        {PRESET_KEYS.map((key) => (
          <Button
            data-preset-key={key}
            key={key}
            onClick={handlePresetClick}
            size="sm"
            type="button"
            variant={presetKey === key ? "default" : "outline"}
          >
            {PRESETS[key]?.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
