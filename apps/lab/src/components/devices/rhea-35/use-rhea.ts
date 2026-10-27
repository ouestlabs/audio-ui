import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import {
  createRheaEngine,
  DEFAULTS,
  type Param,
  stationOf,
  volumeGain,
} from "./audio/engine";

/**
 * What the panel reads and calls: the station and the knobs, the keys, and
 * the tape left under them, on the shared bus. The panel is drawing; the
 * sound is `audio/`.
 */
export function useRhea() {
  const [engine] = useState(() => createRheaEngine(DEFAULTS));
  const [settings, setSettings] = useState(DEFAULTS);

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(settings.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const onParam = useCallback(
    (param: Param, value: number) => {
      setSettings((current) => ({ ...current, [param]: value }));
      if (param !== "volume") {
        engine.set(param, value);
      }
    },
    [engine]
  );
  const changeStation = useCallback(
    (value: number) => onParam("station", value),
    [onParam]
  );

  // The page's one MIDI input: a keyboard runs the tapes (at their own level: the keys feel no touch), and its notes light the keys.
  const midi = useMidiInput({
    onNoteOff: engine.noteOff,
    onNoteOn: engine.noteOn,
  });
  const pressKey = useCallback(
    (pitch: number) => engine.noteOn(pitch),
    [engine]
  );

  const inspected = useMemo(
    () => ({ ...settings, station: stationOf(settings.station) }),
    [settings]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    activeNotes: midi.activeNotes,
    changeStation,
    noteOff: engine.noteOff,
    onParam,
    pressKey,
    remaining: engine.remaining,
    settings,
  };
}
