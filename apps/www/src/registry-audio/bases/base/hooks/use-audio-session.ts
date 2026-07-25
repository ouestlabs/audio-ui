"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  AudioStore,
  AudioStoreApi,
} from "@/registry-audio/bases/base/lib/audio-store";

/**
 * The session a subtree of player components reads from. There is deliberately
 * no module-level fallback: components must sit inside an `AudioProvider`, so a
 * widget can never silently join another player's session.
 */
const AudioStoreContext = createContext<AudioStoreApi | null>(null);

/** The current session's store handle — for imperative reads and subscriptions. */
function useAudioStoreApi(): AudioStoreApi {
  const api = useContext(AudioStoreContext);
  if (!api) {
    throw new Error(
      "Audio player components must be rendered inside <AudioPlayer> or <AudioProvider>."
    );
  }
  return api;
}

/** Subscribes to the current session's store — same call signature as a plain zustand hook. */
function useAudioStore<T>(selector: (state: AudioStore) => T): T {
  return useStore(useAudioStoreApi(), selector);
}

/** Now playing: identity + loading lifecycle. */
function usePlaybackState() {
  return useAudioStore(
    useShallow((state) => ({
      currentTrack: state.currentTrack,
      isBuffering: state.isBuffering,
      isLoading: state.isLoading,
      isPlaying: state.isPlaying,
      pause: state.pause,
      play: state.play,
      togglePlay: state.togglePlay,
    }))
  );
}

/** Scrub position: current time, duration, buffered range, seeking. */
function useSeekState() {
  return useAudioStore(
    useShallow((state) => ({
      bufferedTime: state.bufferedTime,
      currentTime: state.currentTime,
      currentTrack: state.currentTrack,
      duration: state.duration,
      seek: state.seek,
    }))
  );
}

/** Queue contents and navigation. */
function useQueueState() {
  return useAudioStore(
    useShallow((state) => ({
      addToQueue: state.addToQueue,
      clearQueue: state.clearQueue,
      currentQueueIndex: state.currentQueueIndex,
      currentTrack: state.currentTrack,
      moveInQueue: state.moveInQueue,
      next: state.next,
      previous: state.previous,
      queue: state.queue,
      removeFromQueue: state.removeFromQueue,
      repeatMode: state.repeatMode,
      setQueue: state.setQueue,
      setQueueAndPlay: state.setQueueAndPlay,
      togglePlay: state.togglePlay,
    }))
  );
}

/** How the queue behaves: repeat, shuffle, insert position. */
function useQueuePreferences() {
  return useAudioStore(
    useShallow((state) => ({
      changeRepeatMode: state.changeRepeatMode,
      insertMode: state.insertMode,
      repeatMode: state.repeatMode,
      setInsertMode: state.setInsertMode,
      setRepeatMode: state.setRepeatMode,
      shuffle: state.shuffle,
      shuffleEnabled: state.shuffleEnabled,
      unshuffle: state.unshuffle,
    }))
  );
}

/** Volume and mute. */
function useVolumeState() {
  return useAudioStore(
    useShallow((state) => ({
      isMuted: state.isMuted,
      setVolume: state.setVolume,
      toggleMute: state.toggleMute,
      volume: state.volume,
    }))
  );
}

/** Playback speed. */
function usePlaybackRate() {
  return useAudioStore(
    useShallow((state) => ({
      playbackRate: state.playbackRate,
      setPlaybackRate: state.setPlaybackRate,
    }))
  );
}

export {
  AudioStoreContext,
  useAudioStore,
  useAudioStoreApi,
  usePlaybackRate,
  usePlaybackState,
  useQueuePreferences,
  useQueueState,
  useSeekState,
  useVolumeState,
};
