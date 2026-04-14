import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { $htmlAudio, type Track } from "@/lib/html-audio";

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
          queueLength: queue.length,
          currentIndex: currentQueueIndex,
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
  isLoading: false,
  isError: false,
  errorMessage: null,
  isBuffering: false,
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
    (track.duration !== undefined && $htmlAudio.isLive(track.duration));

  set({
    currentTrack: track,
    currentQueueIndex: queueIndex,
    isLoading: true,
    isBuffering: true,
    isError: false,
    errorMessage: null,
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
      // Initial State
      currentTrack: null,
      queue: [],
      isPlaying: false,
      isLoading: false,
      isBuffering: false,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      repeatMode: "none",
      shuffleEnabled: false,
      currentTime: 0,
      duration: 0,
      progress: 0,
      bufferedTime: 0,
      insertMode: "last",
      isError: false,
      errorMessage: null,
      currentQueueIndex: -1,

      // Playback Actions (state only - provider handles actual audio control)
      play() {
        if (get().isLoading) {
          return;
        }
        set({ isPlaying: true });
      },

      pause() {
        set({ isPlaying: false });
      },

      togglePlay() {
        if (get().isLoading) {
          return;
        }
        const state = get();
        set({ isPlaying: !state.isPlaying });
      },

      next() {
        const state = get();
        const nextIndex = calculateNextIndex({
          queue: state.queue,
          currentQueueIndex: state.currentQueueIndex,
          shuffleEnabled: state.shuffleEnabled,
          repeatMode: state.repeatMode,
        });

        const nextTrack = state.queue[nextIndex];
        if (nextIndex === -1 || !nextTrack) {
          set({ isLoading: false, isPlaying: false, isBuffering: false });
          return;
        }

        loadAndPlayTrack({
          track: nextTrack,
          queueIndex: nextIndex,
          set,
          get,
        });
      },

      previous() {
        const state = get();
        const RESTART_THRESHOLD = 3;

        // If track has more than 3 seconds and shuffle is not enabled, restart the track
        if (state.currentTime > RESTART_THRESHOLD && !state.shuffleEnabled) {
          set({ currentTime: 0, progress: 0 });
          return;
        }

        const prevIndex = calculatePreviousIndex({
          queue: state.queue,
          currentQueueIndex: state.currentQueueIndex,
          shuffleEnabled: state.shuffleEnabled,
          repeatMode: state.repeatMode,
        });

        const prevTrack = state.queue[prevIndex];
        if (prevIndex === -1 || !prevTrack) {
          if (prevIndex !== -1) {
            console.error(
              "Inconsistency: previous index is valid but track not found"
            );
          }
          set({ isLoading: false, isPlaying: false, isBuffering: false });
          return;
        }

        loadAndPlayTrack({
          track: prevTrack,
          queueIndex: prevIndex,
          set,
          get,
        });
      },

      seek(time: number) {
        const state = get();
        const duration = state.duration;
        const validTime =
          duration > 0 ? Math.max(0, Math.min(time, duration)) : time;
        const newProgress = duration > 0 ? (validTime / duration) * 100 : 0;
        set({ currentTime: validTime, progress: newProgress });
      },

      setQueueAndPlay(songs: Track[], startIndex: number) {
        const targetTrack = songs[startIndex];
        if (!targetTrack) {
          console.error("[Playback] Invalid startIndex for setQueueAndPlay");
          get().clearQueue();
          set({
            isPlaying: false,
            isLoading: false,
            currentTrack: null,
            currentQueueIndex: -1,
          });
          return;
        }

        get().setQueue(songs, startIndex);

        loadAndPlayTrack({
          track: targetTrack,
          queueIndex: startIndex,
          set,
          get,
        });
      },

      handleTrackEnd() {
        get().next();
      },

      // Queue Actions
      setQueue(tracks: Track[], startIndex = 0) {
        const currentTrack = tracks[startIndex] ?? null;
        set({
          queue: tracks,
          currentQueueIndex: currentTrack ? startIndex : -1,
          currentTrack,
        });
      },

      getCurrentQueueIndex() {
        return get().currentQueueIndex;
      },

      addToQueue(track: Track, mode = "last") {
        const state = get();
        if (!state.currentTrack) {
          set({
            currentTrack: track,
            currentQueueIndex: 0,
            queue: [track],
          });
          return;
        }

        switch (mode) {
          case "first":
            set({
              queue: [track, ...state.queue],
              currentQueueIndex: state.currentQueueIndex + 1,
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

      removeFromQueue(trackId) {
        const state = get();
        const index = state.queue.findIndex((s) => s.id === trackId);
        if (index === -1) {
          return;
        }

        const newQueue = state.queue.filter((s) => s.id !== trackId);
        set({
          queue: newQueue,
          currentQueueIndex:
            index < state.currentQueueIndex
              ? state.currentQueueIndex - 1
              : state.currentQueueIndex,
        });
      },

      clearQueue() {
        set({ queue: [] });
      },

      moveInQueue(fromIndex, toIndex) {
        const newQueue = [...get().queue];
        const [movedItem] = newQueue.splice(fromIndex, 1);
        if (!movedItem) {
          return;
        }

        newQueue.splice(toIndex, 0, movedItem);
        set({ queue: newQueue });
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

      // Control Actions (state only - provider handles actual audio control)
      setVolume(params: { volume: number }) {
        const { volume } = params;
        set({ volume, isMuted: volume === 0 });
      },

      toggleMute() {
        const newMuted = !get().isMuted;
        set({ isMuted: newMuted });
      },

      setPlaybackRate(rate: number) {
        const state = get();
        // Don't allow playback rate changes for live streams
        if (state.duration && $htmlAudio.isLive(state.duration)) {
          return;
        }
        const clampedRate = Math.max(0.25, Math.min(2, rate));
        set({ playbackRate: clampedRate });
      },

      changeRepeatMode() {
        const modes: RepeatMode[] = ["none", "one", "all"];
        const currentIndex = modes.indexOf(get().repeatMode);
        const newMode = modes[(currentIndex + 1) % modes.length];
        set({ repeatMode: newMode });
      },

      setRepeatMode(mode) {
        set({ repeatMode: mode });
      },

      setInsertMode(mode) {
        set({ insertMode: mode });
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
          queue: newQueue,
          currentQueueIndex: 0,
          shuffleEnabled: true,
        });
      },

      unshuffle() {
        set({ shuffleEnabled: false });
      },

      // State Actions
      setCurrentTrack(track: Track | null) {
        const state = get();

        if (!track) {
          set({
            currentTrack: null,
            currentQueueIndex: -1,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            queue: [],
            isLoading: false,
            isError: false,
            errorMessage: null,
          });
          return;
        }

        // Avoid reloading the same track
        if (state.currentTrack?.id === track.id) {
          return;
        }

        // Update queue with a single track
        set({
          currentTrack: track,
          queue: [track],
          currentQueueIndex: 0,
          isLoading: true,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          isError: false,
          errorMessage: null,
        });

        loadAndPlayTrack({
          track,
          queueIndex: 0,
          set,
          get,
        });
      },

      // Internal: used by provider to sync audio time
      syncTime(currentTime: number, duration: number) {
        const newProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
        set({ currentTime, duration, progress: newProgress });
      },
      setError: (message) => {
        set({
          isError: !!message,
          errorMessage: message,
          isLoading: false,
          isPlaying: false,
        });
      },
    })),
    {
      name: "audio:ui:store",
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        repeatMode: state.repeatMode,
        shuffleEnabled: state.shuffleEnabled,
        currentTime: state.currentTime,
        insertMode: state.insertMode,
        currentQueueIndex: state.currentQueueIndex,
      }),
    }
  )
);

export {
  calculateNextIndex,
  calculatePreviousIndex,
  canUseDOM,
  useAudioStore,
  type AudioStore,
  type RepeatMode,
  type InsertMode,
};
