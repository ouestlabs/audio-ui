"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type AudioStore,
  calculateNextIndex,
  canUseDOM,
  useAudioStore,
} from "@/registry-audio/bases/base/lib/audio-store";
import {
  $htmlAudio,
  type Track,
} from "@/registry-audio/bases/base/lib/html-audio";
import type {
  PlaybackEngine,
  PlaybackEngineErrorDetail,
} from "@/registry-audio/bases/base/lib/playback-engine";
import { isLive } from "@/registry-audio/bases/base/lib/playback-engine";

const MAX_ERROR_RETRIES = 3;
const ERROR_RETRY_DELAY = 1000;
const THROTTLE_INTERVAL = 100;
const MIN_UPDATE_THRESHOLD = 0.5;

export function useAudioProvider({
  tracks = [],
  engine = $htmlAudio,
}: {
  tracks?: Track[];
  engine?: PlaybackEngine;
} = {}) {
  const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorRetryCountRef = useRef<number>(0);
  const lastSeekTimeRef = useRef<number>(0);

  const setState = useCallback(
    (
      partial:
        | Partial<AudioStore>
        | ((state: AudioStore) => Partial<AudioStore>)
    ) => {
      useAudioStore.setState(partial);
    },
    []
  );

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const state = useAudioStore.getState();
      const currentQueue = state.queue;
      const tracksChanged =
        currentQueue.length === 0 ||
        currentQueue.length !== tracks.length ||
        currentQueue.some((track, index) => track.id !== tracks[index]?.id);

      if (tracksChanged) {
        const firstTrack = tracks[0];
        useAudioStore.setState({
          currentQueueIndex:
            state.currentQueueIndex === -1 ? 0 : state.currentQueueIndex,
          currentTrack: state.currentTrack || firstTrack,
          queue: tracks,
        });
      }
    }
  }, [tracks]);

  const retryPlayback = useCallback(async () => {
    if (errorRetryCountRef.current >= MAX_ERROR_RETRIES) {
      return false;
    }

    errorRetryCountRef.current += 1;

    const delay = 2 ** (errorRetryCountRef.current - 1) * ERROR_RETRY_DELAY;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("Offline, delaying retry attempt further.");
      return false;
    }

    try {
      console.log(
        `Retry attempt ${errorRetryCountRef.current}: Loading audio...`
      );
      const currentTime = engine.getCurrentTime();
      const wasPlaying = !engine.isPaused();
      const state = useAudioStore.getState();
      if (state.currentTrack) {
        await engine.load({
          startTime: currentTime,
          url: state.currentTrack.url,
        });
        if (wasPlaying) {
          await engine.play();
        }
      }
      return true;
    } catch {
      // Silent error: retry attempt failed
      return false;
    }
  }, [engine]);

  const lastUpdateTimeRef = useRef<number>(0);
  const forceTimeUpdate = useCallback(() => {
    const currentTime = engine.getCurrentTime();
    const duration = engine.getDuration() || 0;
    useAudioStore.getState().syncTime(currentTime, duration);
    lastUpdateTimeRef.current = Date.now();
  }, [engine]);

  const throttledTimeUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < THROTTLE_INTERVAL) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const currentTime = engine.getCurrentTime();
    const state = useAudioStore.getState();

    if (Math.abs(state.currentTime - currentTime) > MIN_UPDATE_THRESHOLD) {
      const duration = engine.getDuration() || 0;
      useAudioStore.getState().syncTime(currentTime, duration);
    }
  }, [engine]);

  const preloadTrack = useCallback((song: Track) => {
    if (!preloadAudioRef.current || preloadAudioRef.current.src === song.url) {
      return;
    }

    try {
      preloadAudioRef.current.src = song.url;
      preloadAudioRef.current.preload = "auto";
      preloadAudioRef.current.load();
    } catch {
      // Silent error: failed to preload next track
      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
      }
    }
  }, []);

  const preloadNextTrack = useCallback(() => {
    if (!preloadAudioRef.current) {
      return;
    }

    const state = useAudioStore.getState();
    const nextIndex = calculateNextIndex({
      currentQueueIndex: state.currentQueueIndex,
      queue: state.queue,
      repeatMode: state.repeatMode,
      shuffleEnabled: state.shuffleEnabled,
    });

    if (nextIndex === -1 || nextIndex >= state.queue.length) {
      return;
    }

    const nextSong = state.queue[nextIndex];
    if (!nextSong || nextSong.id === state.currentTrack?.id) {
      return;
    }

    preloadTrack(nextSong);
  }, [preloadTrack]);

  useEffect(() => {
    if (!canUseDOM()) {
      return;
    }

    engine.init();

    preloadAudioRef.current = new Audio();
    preloadAudioRef.current.muted = true;
    preloadAudioRef.current.preload = "none";

    const abortController = new AbortController();
    const { signal } = abortController;

    const handlePlay = () => {
      errorRetryCountRef.current = 0;
      const state = useAudioStore.getState();
      engine.setPlaybackRate(state.playbackRate);

      setState({
        isBuffering: false,
        isLoading: false,
        isPlaying: true,
      });

      forceTimeUpdate();
      requestAnimationFrame(() => {
        forceTimeUpdate();
      });
      setTimeout(() => {
        forceTimeUpdate();
      }, 50);
      preloadNextTrack();
    };

    const handlePause = () => {
      forceTimeUpdate();
      setState({ isBuffering: false, isPlaying: false });
    };

    const handleErrorRetry = async (recoverable: boolean): Promise<boolean> => {
      if (!recoverable || errorRetryCountRef.current >= MAX_ERROR_RETRIES) {
        return false;
      }

      return await retryPlayback();
    };

    const handleError = async (e: Event) => {
      const detail =
        e instanceof CustomEvent
          ? (e.detail as PlaybackEngineErrorDetail | undefined)
          : undefined;
      const initialMessage = detail?.message ?? "Unknown audio error";
      const recoverable = detail?.recoverable ?? false;

      if (await handleErrorRetry(recoverable)) {
        return;
      }

      const finalMessage =
        recoverable && errorRetryCountRef.current >= MAX_ERROR_RETRIES
          ? `Failed after ${MAX_ERROR_RETRIES} attempts: ${initialMessage}`
          : initialMessage;

      setState({
        errorMessage: finalMessage,
        isBuffering: false,
        isError: true,
        isLoading: false,
        isPlaying: false,
      });
    };

    const handleEnded = async () => {
      setState({ isBuffering: false, isPlaying: false });

      const state = useAudioStore.getState();

      const audioDuration = engine.getDuration() || 0;
      const isLiveStream = isLive(audioDuration);

      if (state.currentTrack && isLiveStream) {
        setState({
          errorMessage: "Live stream connection lost",
          isError: true,
        });
        return;
      }
      if (state.repeatMode === "one" && state.currentTrack) {
        try {
          await engine.load({
            isLiveStream,
            startTime: 0,
            url: state.currentTrack.url,
          });
          await engine.play();
          setState({ currentTime: 0, progress: 0 });
          return;
        } catch {
          // Silent error: repeat mode playback error
        }
      }

      state.handleTrackEnd();
    };

    const getLoadingSuccessState = (duration = 0) => ({
      duration,
      errorMessage: null,
      isBuffering: false,
      isError: false,
      isLoading: false,
    });

    const handleLoadStart = () => {
      setState({
        errorMessage: null,
        isBuffering: false,
        isError: false,
        isLoading: true,
      });
    };

    const handleCanPlay = () => {
      setState(getLoadingSuccessState(engine.getDuration() || 0));
    };

    const handleWaiting = () => {
      setState({ isBuffering: true, isLoading: false });
    };

    const handlePlaying = () => {
      setState({
        ...getLoadingSuccessState(),
        isPlaying: true,
      });
    };

    const handleDurationChange = () => {
      setState({ duration: engine.getDuration() || 0 });
    };

    const handleVolumeChange = () => {
      const prev = useAudioStore.getState();
      const nextMuted = engine.isMuted();
      if (prev.isMuted !== nextMuted) {
        setState({ isMuted: nextMuted });
      }
    };

    const handleBufferUpdate = (e: Event) => {
      if (e instanceof CustomEvent && e.detail?.bufferedTime !== undefined) {
        setState({ bufferedTime: e.detail.bufferedTime });
      }
    };

    const restoreState = async () => {
      const state = useAudioStore.getState();

      if (!state.currentTrack || state.currentTime <= 0) {
        return;
      }

      const track = state.currentTrack;
      const audioDuration = engine.getDuration() || state.duration || 0;
      const isLiveStream = isLive(audioDuration);
      const startTime = isLiveStream ? 0 : state.currentTime;
      const volume = state.volume;
      const muted = state.isMuted;
      const playbackRate = state.playbackRate;

      try {
        setState({ isLoading: true });

        await engine.load({
          isLiveStream,
          startTime,
          url: track.url,
        });
        engine.setVolume({ volume });
        engine.setMuted(muted);
        engine.setPlaybackRate(playbackRate);

        setState({ isLoading: false, isPlaying: false });
      } catch {
        setState({
          errorMessage: "Error restoring audio state",
          isBuffering: false,
          isError: true,
          isLoading: false,
          isPlaying: false,
        });
      }
    };

    engine.addEventListener("play", handlePlay, { signal });
    engine.addEventListener("pause", handlePause, { signal });
    engine.addEventListener("playing", handlePlaying, { signal });
    engine.addEventListener("waiting", handleWaiting, { signal });
    engine.addEventListener("loadstart", handleLoadStart, { signal });
    engine.addEventListener("canplay", handleCanPlay, { signal });
    engine.addEventListener("canplaythrough", handleCanPlay, { signal });
    engine.addEventListener("timeupdate", throttledTimeUpdate, { signal });
    engine.addEventListener("durationchange", handleDurationChange, {
      signal,
    });
    engine.addEventListener("volumechange", handleVolumeChange, { signal });
    engine.addEventListener("ended", handleEnded, { signal });
    engine.addEventListener("error", handleError, { signal });
    engine.addEventListener("bufferupdate", handleBufferUpdate, { signal });

    restoreState();

    const unsubscribeTrack = useAudioStore.subscribe(
      (state) => state.currentTrack?.id,
      (newSongId, oldSongId) => {
        if (newSongId && newSongId !== oldSongId) {
          errorRetryCountRef.current = 0;
          preloadNextTrack();
        }
      }
    );

    const unsubscribePlaybackRate = useAudioStore.subscribe(
      (state) => state.playbackRate,
      (playbackRate) => {
        engine.setPlaybackRate(playbackRate);
      }
    );

    const unsubscribeIsPlaying = useAudioStore.subscribe(
      (state) => state.isPlaying,
      async (isPlaying) => {
        const isPaused = engine.isPaused();
        const shouldPlay = isPlaying && isPaused;
        const isPlayingState = !isPaused;
        const shouldPause = !isPlaying && isPlayingState;
        const needsAction = shouldPlay || shouldPause;

        if (!needsAction) {
          return;
        }

        try {
          if (shouldPlay) {
            await engine.play();
          } else {
            engine.pause();
          }
        } catch {
          // Silent error: error syncing play/pause state
        }
      }
    );

    const unsubscribeCurrentTrack = useAudioStore.subscribe(
      (state) => state.currentTrack,
      async (track, prevTrack) => {
        if (!track || track.id === prevTrack?.id) {
          return;
        }

        try {
          await engine.load({
            isLiveStream: false,
            startTime: 0,
            url: track.url,
          });

          const currentState = useAudioStore.getState();
          if (currentState.isPlaying) {
            await engine.play();
          }
        } catch {
          useAudioStore.getState().setError("Error loading track");
        }
      }
    );

    const unsubscribeSeek = useAudioStore.subscribe(
      (state) => state.currentTime,
      (currentTime) => {
        const engineTime = engine.getCurrentTime();
        const timeDiff = Math.abs(engineTime - currentTime);
        const isDifferentSeek = currentTime !== lastSeekTimeRef.current;
        if (timeDiff > 0.1 && isDifferentSeek) {
          lastSeekTimeRef.current = currentTime;
          engine.setCurrentTime(currentTime);
        }
      }
    );

    const unsubscribeVolume = useAudioStore.subscribe(
      (state) => state.volume,
      (volume) => {
        engine.setVolume({ volume });
      }
    );

    const unsubscribeMuted = useAudioStore.subscribe(
      (state) => state.isMuted,
      (isMuted) => {
        engine.setMuted(isMuted);
      }
    );

    return () => {
      abortController.abort();

      if (preloadAudioRef.current) {
        preloadAudioRef.current.src = "";
        preloadAudioRef.current = null;
      }

      unsubscribeTrack();
      unsubscribePlaybackRate();
      unsubscribeIsPlaying();
      unsubscribeCurrentTrack();
      unsubscribeSeek();
      unsubscribeVolume();
      unsubscribeMuted();
    };
  }, [
    throttledTimeUpdate,
    setState,
    retryPlayback,
    preloadNextTrack,
    engine,
    forceTimeUpdate,
  ]);

  useEffect(() => {
    const unsubscribe = useAudioStore.subscribe(
      (state) => state.queue,
      (newQueue, oldQueue) => {
        if (
          (newQueue.length !== oldQueue.length || newQueue.length === 0) &&
          preloadAudioRef.current
        ) {
          preloadAudioRef.current.src = "";
        }
      }
    );
    return unsubscribe;
  }, []);
}
