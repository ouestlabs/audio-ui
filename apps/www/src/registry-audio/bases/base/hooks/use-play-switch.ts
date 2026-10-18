"use client";

import { useSyncExternalStore } from "react";
import {
  silentPlay,
  useAudioSession,
} from "@/registry-audio/bases/base/hooks/use-audio-session";

const OFF = { on: false };

/**
 * The play switch of the nearest session: a button in its bar flips it, and
 * every component inside the session that reads it follows. It holds no
 * audio, only whether the sound should be on, so a demo can leave its play
 * button to its host. Outside a session it stays off and does nothing.
 */
export function usePlaySwitch() {
  const play = useAudioSession()?.play ?? silentPlay;
  const { on } = useSyncExternalStore(play.subscribe, play.get, () => OFF);
  return {
    attach: play.attach,
    playing: on,
    setPlaying: play.setOn,
    toggle: play.toggle,
  };
}
