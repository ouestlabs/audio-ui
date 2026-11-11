"use client";

import { downloadFile } from "@audio-ui/engine/files";
import { useCallback, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { ExportDialog } from "@/registry-audio/bases/base/audio/elements/export-dialog";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  exportSound,
} from "@/registry-audio/bases/base/lib/audio-export";

const RATE = 48_000;

/** Two seconds of an A minor chord, fading out, the same on both sides: the sound the demo exports. */
const CHORD = (() => {
  const channel = Float32Array.from({ length: RATE * 2 }, (_, frame) => {
    const time = frame / RATE;
    const tones = [220, 261.63, 329.63].reduce(
      (sum, hz) => sum + Math.sin(2 * Math.PI * hz * time),
      0
    );
    return 0.15 * tones * Math.exp(-1.5 * time);
  });
  return [channel, channel];
})();

/** The export dialog over a chord: pick a format and a level, and Export saves the file and says how loud it came out. */
export default function ExportDialogDemo() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_EXPORT_SETTINGS);
  const [status, setStatus] = useState("");
  const show = useCallback(() => setOpen(true), []);
  const exportChord = useCallback(async (picked: ExportSettings) => {
    const name = `chord.${picked.format}`;
    setStatus(`Exporting ${name}…`);
    const { file, loudness } = await exportSound(CHORD, RATE, picked);
    downloadFile(file, name);
    setStatus(
      `Exported ${name}: ${loudness.lufs.toFixed(1)} LUFS, ${loudness.truePeak.toFixed(1)} dBTP`
    );
  }, []);
  return (
    <div className="flex flex-col items-center gap-3">
      <Button onClick={show} variant="outline">
        Export…
      </Button>
      <ExportDialog
        onExport={exportChord}
        onOpenChange={setOpen}
        onSettingsChange={setSettings}
        open={open}
        range="Two seconds of a chord"
        settings={settings}
      />
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {status}
      </p>
    </div>
  );
}
