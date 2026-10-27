import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMicrophone } from "@/hooks/use-microphone";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import {
  createMaiaEngine,
  DEFAULTS,
  type Param,
  volumeGain,
} from "./audio/engine";
import { renderVoice } from "./audio/voice";

export type Source = "Mic" | "Voice";
export const SOURCES: readonly Source[] = ["Voice", "Mic"];

/**
 * What the panel reads and calls: the voice (the built-in one, or the
 * microphone), the knobs, the keys that are held, and the bands the display
 * lights, on the shared bus. The panel is drawing; the sound is `audio/`.
 */
export function useMaia() {
  const [engine] = useState(() => createMaiaEngine(DEFAULTS));
  const [settings, setSettings] = useState(DEFAULTS);
  const [source, setSource] = useState<Source>("Voice");
  const [voice, setVoice] = useState<AudioBuffer | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [hold, setHold] = useState(false);
  const [latched, setLatched] = useState<readonly number[]>([]);
  const [analysers, setAnalysers] = useState<readonly AnalyserNode[]>([]);
  const microphone = useMicrophone();

  const bus = useMasterBus(volumeGain(settings.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    setAnalysers(engine.analysers());
    return () => {
      setAnalysers([]);
      engine.detach();
    };
  }, [bus, engine]);

  // The built-in voice is rendered once, as a recording would be decoded.
  useEffect(() => {
    let current = true;
    renderVoice().then((buffer) => {
      if (current) {
        setVoice(buffer);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  // The microphone, while it listens, is the modulator; it is read, never played out.
  useEffect(() => {
    engine.listen(source === "Mic" ? microphone.analyser : null);
  }, [engine, microphone.analyser, source]);

  /** Wakes the shared context: the first press is a gesture, and the promise is not awaited. */
  const wake = useCallback(() => {
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
  }, [bus]);

  /** Play speaks the built-in voice; on the microphone it listens, which asks for permission. */
  const toggle = useCallback(() => {
    if (source === "Mic") {
      if (microphone.isListening) {
        microphone.stop();
      } else {
        microphone.start();
      }
      return;
    }
    if (speaking) {
      engine.stop();
      setSpeaking(false);
      return;
    }
    if (voice) {
      wake();
      engine.play(voice);
      setSpeaking(true);
    }
  }, [engine, microphone, source, speaking, voice, wake]);

  const changeSource = useCallback(
    (next: string) => {
      setSource(next as Source);
      if (next === "Mic") {
        engine.stop();
        setSpeaking(false);
      } else {
        microphone.stop();
      }
    },
    [engine, microphone]
  );

  const onParam = useCallback(
    (param: Param, value: number) => {
      setSettings((current) => ({ ...current, [param]: value }));
      if (param !== "volume") {
        engine.set(param, value);
      }
    },
    [engine]
  );

  /** A key: it plays while held, or, with Hold on, stays on until it is pressed again. */
  const pressKey = useCallback(
    (pitch: number) => {
      if (!hold) {
        engine.noteOn(pitch);
        return;
      }
      if (latched.includes(pitch)) {
        engine.noteOff(pitch);
        setLatched(latched.filter((note) => note !== pitch));
      } else {
        engine.noteOn(pitch);
        setLatched([...latched, pitch]);
      }
    },
    [engine, hold, latched]
  );
  const releaseKey = useCallback(
    (pitch: number) => {
      if (!hold) {
        engine.noteOff(pitch);
      }
    },
    [engine, hold]
  );
  const toggleHold = useCallback(() => {
    if (hold) {
      engine.releaseAll();
      setLatched([]);
    }
    setHold(!hold);
  }, [engine, hold]);

  // The page's one MIDI input: a keyboard plays the carrier, and its notes light the keys.
  const midi = useMidiInput({
    onNoteOff: releaseKey,
    onNoteOn: pressKey,
  });
  const activeNotes = useMemo(
    () => [...new Set([...midi.activeNotes, ...latched])],
    [latched, midi.activeNotes]
  );

  const running = source === "Mic" ? microphone.isListening : speaking;
  const inspected = useMemo(
    () => ({
      hold: hold ? "on" : "off",
      keys: latched.length,
      source,
      voice: running ? "speaking" : "silent",
      ...settings,
    }),
    [hold, latched.length, running, settings, source]
  );
  usePublishInspector({ output: bus, patch: inspected });

  let status = "Play the voice, and hold keys: the synth says the words.";
  if (source === "Mic") {
    status =
      microphone.error ??
      (microphone.isListening
        ? "Listening. Wear headphones, or the speakers reach the mic."
        : "Listen asks for the microphone. Then talk, and hold keys.");
  }

  return {
    activeNotes,
    analysers,
    changeSource,
    hold,
    onParam,
    pressKey,
    ready: source === "Mic" || voice !== null,
    releaseKey,
    running,
    settings,
    source,
    status,
    toggle,
    toggleHold,
  };
}
