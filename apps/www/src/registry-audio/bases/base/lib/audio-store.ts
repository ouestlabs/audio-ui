import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import type { Track } from "@/registry-audio/bases/base/lib/html-audio";
import {
  clampPlaybackRate,
  isLive,
} from "@/registry-audio/bases/base/lib/playback-engine";

type RepeatMode = "none" | "one" | "all";
type InsertMode = "first" | "last" | "after";

type AudioStore = {
  // State
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  bufferedTime: number;
  insertMode: InsertMode;
  isError: boolean;
  errorMessage: string | null;
  currentQueueIndex: number;

  // Playback Actions (these update state only, audio control is handled by provider)
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setQueueAndPlay: (tracks: Track[], startIndex: number) => void;
  handleTrackEnd: () => void;

  // Internal: used by provider to sync audio state
  syncTime: (currentTime: number, duration: number) => void;

  // Queue Actions
  addToQueue: (track: Track, mode?: InsertMode) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  getCurrentQueueIndex: () => number;
  addTracksToEndOfQueue: (tracksToAdd: Track[]) => void;

  // Control Actions
  setVolume: (params: { volume: number }) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  changeRepeatMode: () => void;
  setInsertMode: (mode: InsertMode) => void;
  shuffle: () => void;
  unshuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;

  // State Actions
  setCurrentTrack: (track: Track | null) => void;
  setError: (message: string | null) => void;
};

function canUseDOM() {
  return !!(
    typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
  );
}

type QueueNavigationParams = {
  queue: Track[];
  currentQueueIndex: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
};

type GetRandomShuffleIndexParams = {
  queueLength: number;
  currentIndex: number;
};

/**
 * Calculates a random index for shuffle mode
 */
const getRandomShuffleIndex = (params: GetRandomShuffleIndexParams): number => {
  const { queueLength, currentIndex } = params;
  if (queueLength === 1) {
    return 0;
  }
  let randomIndex: number;
  do {
    randomIndex = Math.floor(Math.random() * queueLength);
  } while (randomIndex === currentIndex);
  return randomIndex;
};

type CalculateQueueIndexParams = QueueNavigationParams & {
  direction: 1 | -1;
};

/**
 * Calculates the next or previous index in the queue based on direction
 */
const calculateQueueIndex = (params: CalculateQueueIndexParams): number => {
  const { queue, currentQueueIndex, shuffleEnabled, repeatMode, direction } =
    params;

  if (queue.length === 0) {
    return -1;
  }

  if (shuffleEnabled) {
    const singleTrackIndex = repeatMode === "none" ? -1 : 0;
    return queue.length === 1
      ? singleTrackIndex
      : getRandomShuffleIndex({
          currentIndex: currentQueueIndex,
          queueLength: queue.length,
        });
  }

  const newIndex = currentQueueIndex + direction;
  const isAtEnd = newIndex >= queue.length;
  const isAtStart = newIndex < 0;

  if (isAtEnd) {
    return repeatMode === "all" ? 0 : -1;
  }

  if (isAtStart) {
    return repeatMode === "all" ? queue.length - 1 : -1;
  }

  return newIndex;
};

/**
 * Calculates the index of the next track
 */
const calculateNextIndex = (params: QueueNavigationParams): number =>
  calculateQueueIndex({
    ...params,
    direction: 1,
  });

/**
 * Calculates the index of the previous track
 */
const calculatePreviousIndex = (params: QueueNavigationParams): number =>
  calculateQueueIndex({
    ...params,
    direction: -1,
  });

/**
 * Default state after successful track loading
 */
const getSuccessState = (params: { isPlaying?: boolean } = {}) => ({
  errorMessage: null,
  isBuffering: false,
  isError: false,
  isLoading: false,
  isPlaying: params.isPlaying ?? false,
});

type LoadAndPlayTrackParams = {
  track: Track;
  queueIndex: number;
  set: (partial: Partial<AudioStore>) => void;
  get: () => AudioStore;
};

/**
 * Loads and plays a track with error handling
 * Note: This function only updates state. Actual audio loading/playing
 * is handled by the provider which listens to state changes.
 */
const loadAndPlayTrack = (params: LoadAndPlayTrackParams): void => {
  const { track, queueIndex, set, get } = params;
  // Check if it's a live stream using track.live property or duration
  const isLiveStream =
    track.live === true ||
    (track.duration !== undefined && isLive(track.duration));

  set({
    currentQueueIndex: queueIndex,
    currentTrack: track,
    errorMessage: null,
    isBuffering: true,
    isError: false,
    isLoading: true,
  });

  // Reset playback rate to 1.0 for live streams
  if (isLiveStream) {
    const currentState = get();
    if (currentState.playbackRate !== 1) {
      set({ playbackRate: 1 });
    }
  }

  // State will be updated by provider when audio loads/plays
  set(getSuccessState({ isPlaying: true }));
};

const useAudioStore = create<AudioStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      addToQueue(track: Track, mode = "last") {
        const state = get();
        if (!state.currentTrack) {
          set({
            currentQueueIndex: 0,
            currentTrack: track,
            queue: [track],
          });
          return;
        }

        switch (mode) {
          case "first":
            set({
              currentQueueIndex: state.currentQueueIndex + 1,
              queue: [track, ...state.queue],
            });
            break;
          case "after":
            set({
              queue: [
                ...state.queue.slice(0, state.currentQueueIndex + 1),
                track,
                ...state.queue.slice(state.currentQueueIndex + 1),
              ],
            });
            break;
          default:
            set({ queue: [...state.queue, track] });
        }
      },

      addTracksToEndOfQueue(tracksToAdd: Track[]) {
        if (!tracksToAdd || tracksToAdd.length === 0) {
          return;
        }

        const state = get();
        const currentQueueIds = new Set(state.queue.map((s) => s.id));
        const newTracks = tracksToAdd.filter(
          (track) => !currentQueueIds.has(track.id)
        );

        if (newTracks.length > 0) {
          set({ queue: [...state.queue, ...newTracks] });
        }
      },
      bufferedTime: 0,

      changeRepeatMode() {
        const modes: RepeatMode[] = ["none", "one", "all"];
        const currentIndex = modes.indexOf(get().repeatMode);
        const newMode = modes[(currentIndex + 1) % modes.length];
        set({ repeatMode: newMode });
      },

      clearQueue() {
        set({ queue: [] });
      },
      currentQueueIndex: -1,
      currentTime: 0,
      // Initial State
      currentTrack: null,
      duration: 0,
      errorMessage: null,

      getCurrentQueueIndex() {
        return get().currentQueueIndex;
      },

      handleTrackEnd() {
        get().next();
      },
      insertMode: "last",
      isBuffering: false,
      isError: false,
      isLoading: false,
      isMuted: false,
      isPlaying: false,

      moveInQueue(fromIndex, toIndex) {
        const newQueue = [...get().queue];
        const [movedItem] = newQueue.splice(fromIndex, 1);
        if (!movedItem) {
          return;
        }

        newQueue.splice(toIndex, 0, movedItem);
        set({ queue: newQueue });
      },

      next() {
        const state = get();
        const nextIndex = calculateNextIndex({
          currentQueueIndex: state.currentQueueIndex,
          queue: state.queue,
          repeatMode: state.repeatMode,
          shuffleEnabled: state.shuffleEnabled,
        });

        const nextTrack = state.queue[nextIndex];
        if (nextIndex === -1 || !nextTrack) {
          set({ isBuffering: false, isLoading: false, isPlaying: false });
          return;
        }

        loadAndPlayTrack({
          get,
          queueIndex: nextIndex,
          set,
          track: nextTrack,
        });
      },

      pause() {
        set({ isPlaying: false });
      },

      // Playback Actions (state only - provider handles actual audio control)
      play() {
        if (get().isLoading) {
          return;
        }
        set({ isPlaying: true });
      },
      playbackRate: 1,

      previous() {
        const state = get();
        const RESTART_THRESHOLD = 3;

        // If track has more than 3 seconds and shuffle is not enabled, restart the track
        if (state.currentTime > RESTART_THRESHOLD && !state.shuffleEnabled) {
          set({ currentTime: 0, progress: 0 });
          return;
        }

        const prevIndex = calculatePreviousIndex({
          currentQueueIndex: state.currentQueueIndex,
          queue: state.queue,
          repeatMode: state.repeatMode,
          shuffleEnabled: state.shuffleEnabled,
        });

        const prevTrack = state.queue[prevIndex];
        if (prevIndex === -1 || !prevTrack) {
          if (prevIndex !== -1) {
            console.error(
              "Inconsistency: previous index is valid but track not found"
            );
          }
          set({ isBuffering: false, isLoading: false, isPlaying: false });
          return;
        }

        loadAndPlayTrack({
          get,
          queueIndex: prevIndex,
          set,
          track: prevTrack,
        });
      },
      progress: 0,
      queue: [],

      removeFromQueue(trackId) {
        const state = get();
        const index = state.queue.findIndex((s) => s.id === trackId);
        if (index === -1) {
          return;
        }

        const newQueue = state.queue.filter((s) => s.id !== trackId);
        set({
          currentQueueIndex:
            index < state.currentQueueIndex
              ? state.currentQueueIndex - 1
              : state.currentQueueIndex,
          queue: newQueue,
        });
      },
      repeatMode: "none",

      seek(time: number) {
        const state = get();
        const duration = state.duration;
        const validTime =
          duration > 0 ? Math.max(0, Math.min(time, duration)) : time;
        const newProgress = duration > 0 ? (validTime / duration) * 100 : 0;
        set({ currentTime: validTime, progress: newProgress });
      },

      // State Actions
      setCurrentTrack(track: Track | null) {
        const state = get();

        if (!track) {
          set({
            currentQueueIndex: -1,
            currentTime: 0,
            currentTrack: null,
            duration: 0,
            errorMessage: null,
            isError: false,
            isLoading: false,
            isPlaying: false,
            queue: [],
          });
          return;
        }

        // Avoid reloading the same track
        if (state.currentTrack?.id === track.id) {
          return;
        }

        // Update queue with a single track
        set({
          currentQueueIndex: 0,
          currentTime: 0,
          currentTrack: track,
          duration: 0,
          errorMessage: null,
          isError: false,
          isLoading: true,
          isPlaying: false,
          queue: [track],
        });

        loadAndPlayTrack({
          get,
          queueIndex: 0,
          set,
          track,
        });
      },
      setError: (message) => {
        set({
          errorMessage: message,
          isError: !!message,
          isLoading: false,
          isPlaying: false,
        });
      },

      setInsertMode(mode) {
        set({ insertMode: mode });
      },

      setPlaybackRate(rate: number) {
        const state = get();
        // Don't allow playback rate changes for live streams
        if (state.duration && isLive(state.duration)) {
          return;
        }
        set({ playbackRate: clampPlaybackRate(rate) });
      },

      // Queue Actions
      setQueue(tracks: Track[], startIndex = 0) {
        const currentTrack = tracks[startIndex] ?? null;
        set({
          currentQueueIndex: currentTrack ? startIndex : -1,
          currentTrack,
          queue: tracks,
        });
      },

      setQueueAndPlay(songs: Track[], startIndex: number) {
        const targetTrack = songs[startIndex];
        if (!targetTrack) {
          console.error("[Playback] Invalid startIndex for setQueueAndPlay");
          get().clearQueue();
          set({
            currentQueueIndex: -1,
            currentTrack: null,
            isLoading: false,
            isPlaying: false,
          });
          return;
        }

        get().setQueue(songs, startIndex);

        loadAndPlayTrack({
          get,
          queueIndex: startIndex,
          set,
          track: targetTrack,
        });
      },

      setRepeatMode(mode) {
        set({ repeatMode: mode });
      },

      // Control Actions (state only - provider handles actual audio control)
      setVolume(params: { volume: number }) {
        const { volume } = params;
        set({ isMuted: volume === 0, volume });
      },

      shuffle() {
        const state = get();
        if (
          !state.queue.length ||
          state.queue.length < 2 ||
          !state.currentTrack
        ) {
          return;
        }

        const remainingQueue = state.queue.filter(
          (_, index) => index !== state.currentQueueIndex
        );
        const shuffledRemaining = remainingQueue.sort(
          () => Math.random() - 0.5
        );
        const newQueue = [state.currentTrack, ...shuffledRemaining];

        set({
          currentQueueIndex: 0,
          queue: newQueue,
          shuffleEnabled: true,
        });
      },
      shuffleEnabled: false,

      // Internal: used by provider to sync audio time
      syncTime(currentTime: number, duration: number) {
        const newProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
        set({ currentTime, duration, progress: newProgress });
      },

      toggleMute() {
        const newMuted = !get().isMuted;
        set({ isMuted: newMuted });
      },

      togglePlay() {
        if (get().isLoading) {
          return;
        }
        const state = get();
        set({ isPlaying: !state.isPlaying });
      },

      unshuffle() {
        set({ shuffleEnabled: false });
      },
      volume: 1,
    })),
    {
      name: "audio:ui:store",
      partialize: (state) => ({
        currentQueueIndex: state.currentQueueIndex,
        currentTime: state.currentTime,
        currentTrack: state.currentTrack,
        insertMode: state.insertMode,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        queue: state.queue,
        repeatMode: state.repeatMode,
        shuffleEnabled: state.shuffleEnabled,
        volume: state.volume,
      }),
    }
  )
);

export {
  type AudioStore,
  calculateNextIndex,
  calculatePreviousIndex,
  canUseDOM,
  type InsertMode,
  type RepeatMode,
  useAudioStore,
};
