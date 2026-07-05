"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudio } from "@/registry-audio/bases/base/hooks/use-audio";
import {
  type AudioStore,
  calculateNextIndex,
  canUseDOM,
  useAudioStore,
} from "@/registry-audio/bases/base/lib/audio-store";
import type { Track } from "@/registry-audio/bases/base/lib/html-audio";

const MAX_ERROR_RETRIES = 3;
const ERROR_RETRY_DELAY = 1000;
const THROTTLE_INTERVAL = 100;
const MIN_UPDATE_THRESHOLD = 0.5;

const getErrorInfo = (
  errorCode: number
): { message: string; recoverable: boolean } => {
  switch (errorCode) {
    case MediaError.MEDIA_ERR_ABORTED:
      return { message: "Playback cancelled", recoverable: true };
    case MediaError.MEDIA_ERR_NETWORK:
      return { message: "Network error", recoverable: true };
    case MediaError.MEDIA_ERR_DECODE:
      return { message: "Audio file decoding error", recoverable: false };
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return {
        message: "File/network loading error (Code 4)",
        recoverable: true,
      };
    default:
      return { message: `Unknown error (${errorCode})`, recoverable: true };
  }
};

const parseAudioError = (
  e: Event,
  audio: HTMLAudioElement
): { message: string; recoverable: boolean; errorCode: number } => {
  if (audio.error) {
    const errorCode = audio.error.code;
    const errorInfo = getErrorInfo(errorCode);
    return { ...errorInfo, errorCode };
  }

  if (e instanceof ErrorEvent) {
    return { message: e.message, recoverable: true, errorCode: 0 };
  }

  return { message: "Unknown audio error", recoverable: false, errorCode: 0 };
};

export function useAudioProvider({ tracks = [] }: { tracks?: Track[] } = {}) {
  const { htmlAudio } = useAudio();
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
          queue: tracks,
          currentTrack: state.currentTrack || firstTrack,
          currentQueueIndex:
            state.currentQueueIndex === -1 ? 0 : state.currentQueueIndex,
        });
      }
    }
  }, [tracks]);

  const retryPlayback = useCallback(
    async (audio: HTMLAudioElement) => {
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
        const currentTime = audio.currentTime;
        const wasPlaying = !audio.paused;
        const state = useAudioStore.getState();
        if (state.currentTrack) {
          await htmlAudio.load({
            url: state.currentTrack.url,
            startTime: currentTime,
          });
          if (wasPlaying) {
            await htmlAudio.play();
          }
        }
        return true;
      } catch {
        // Silent error: retry attempt failed
        return false;
      }
    },
    [htmlAudio]
  );

  const lastUpdateTimeRef = useRef<number>(0);
  const forceTimeUpdate = useCallback(() => {
    const audio = htmlAudio.getAudioElement();
    if (!audio) {
      return;
    }

    const currentTime = audio.currentTime;
    const duration = audio.duration || 0;
    useAudioStore.getState().syncTime(currentTime, duration);
    lastUpdateTimeRef.current = Date.now();
  }, [htmlAudio]);

  const throttledTimeUpdate = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < THROTTLE_INTERVAL) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const audio = htmlAudio.getAudioElement();
    if (!audio) {
      return;
    }

    const currentTime = audio.currentTime;
    const state = useAudioStore.getState();

    if (Math.abs(state.currentTime - currentTime) > MIN_UPDATE_THRESHOLD) {
      const duration = audio.duration || 0;
      useAudioStore.getState().syncTime(currentTime, duration);
    }
  }, [htmlAudio]);

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
      queue: state.queue,
      currentQueueIndex: state.currentQueueIndex,
      shuffleEnabled: state.shuffleEnabled,
      repeatMode: state.repeatMode,
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

    htmlAudio.init();

    preloadAudioRef.current = new Audio();
    preloadAudioRef.current.muted = true;
    preloadAudioRef.current.preload = "none";

    const audio = htmlAudio.getAudioElement();
    if (!audio) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const handlePlay = () => {
      errorRetryCountRef.current = 0;
      const state = useAudioStore.getState();
      htmlAudio.setPlaybackRate(state.playbackRate);

      setState({
        isPlaying: true,
        isLoading: false,
        isBuffering: false,
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
      setState({ isPlaying: false, isBuffering: false });
    };

    const handleErrorRetry = async (
      audioElement: HTMLAudioElement,
      recoverable: boolean
    ): Promise<boolean> => {
      if (!recoverable || errorRetryCountRef.current >= MAX_ERROR_RETRIES) {
        return false;
      }

      return await retryPlayback(audioElement);
    };

    const handleError = async (e: Event) => {
      const { message: initialMessage, recoverable } = parseAudioError(
        e,
        audio
      );

      if (await handleErrorRetry(audio, recoverable)) {
        return;
      }

      const finalMessage =
        recoverable && errorRetryCountRef.current >= MAX_ERROR_RETRIES
          ? `Failed after ${MAX_ERROR_RETRIES} attempts: ${initialMessage}`
          : initialMessage;

      setState({
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
        isError: true,
        errorMessage: finalMessage,
      });
    };

    const handleEnded = async () => {
      setState({ isPlaying: false, isBuffering: false });

      const state = useAudioStore.getState();

      const audioElement = htmlAudio.getAudioElement();
      const audioDuration = audioElement?.duration || 0;
      const isLiveStream = htmlAudio.isLive(audioDuration);

      if (state.currentTrack && isLiveStream) {
        setState({
          isError: true,
          errorMessage: "Live stream connection lost",
        });
        return;
      }
      if (state.repeatMode === "one" && state.currentTrack) {
        try {
          await htmlAudio.load({
            url: state.currentTrack.url,
            startTime: 0,
            isLiveStream,
          });
          await htmlAudio.play();
          setState({ currentTime: 0, progress: 0 });
          return;
        } catch {
          // Silent error: repeat mode playback error
        }
      }

      state.handleTrackEnd();
    };

    const getLoadingSuccessState = (duration = 0) => ({
      isLoading: false,
      isBuffering: false,
      duration,
      isError: false,
      errorMessage: null,
    });

    const handleLoadStart = () => {
      setState({
        isLoading: true,
        isBuffering: false,
        isError: false,
        errorMessage: null,
      });
    };

    const handleCanPlay = () => {
      setState(getLoadingSuccessState(audio.duration || 0));
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
      setState({ duration: audio.duration || 0 });
    };

    const handleVolumeChange = () => {
      const prev = useAudioStore.getState();
      const nextMuted = audio.muted;
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
      const audioElement = htmlAudio.getAudioElement();
      const audioDuration = audioElement?.duration || state.duration || 0;
      const isLiveStream = htmlAudio.isLive(audioDuration);
      const startTime = isLiveStream ? 0 : state.currentTime;
      const volume = state.volume;
      const muted = state.isMuted;
      const playbackRate = state.playbackRate;

      try {
        setState({ isLoading: true });

        await htmlAudio.load({
          url: track.url,
          startTime,
          isLiveStream,
        });
        htmlAudio.setVolume({ volume });
        htmlAudio.setMuted(muted);
        htmlAudio.setPlaybackRate(playbackRate);

        setState({ isLoading: false, isPlaying: false });
      } catch {
        setState({
          isError: true,
          errorMessage: "Error restoring audio state",
          isPlaying: false,
          isLoading: false,
          isBuffering: false,
        });
      }
    };

    audio.addEventListener("play", handlePlay, { signal });
    audio.addEventListener("pause", handlePause, { signal });
    audio.addEventListener("playing", handlePlaying, { signal });
    audio.addEventListener("waiting", handleWaiting, { signal });
    audio.addEventListener("loadstart", handleLoadStart, { signal });
    audio.addEventListener("canplay", handleCanPlay, { signal });
    audio.addEventListener("canplaythrough", handleCanPlay, { signal });
    audio.addEventListener("timeupdate", throttledTimeUpdate, { signal });
    audio.addEventListener("durationchange", handleDurationChange, { signal });
    audio.addEventListener("loadedmetadata", handleDurationChange, { signal });
    audio.addEventListener("volumechange", handleVolumeChange, { signal });
    audio.addEventListener("ended", handleEnded, { signal });
    audio.addEventListener("error", handleError, { signal });

    htmlAudio.addEventListener("bufferUpdate", handleBufferUpdate);

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
        htmlAudio.setPlaybackRate(playbackRate);
      }
    );

    const unsubscribeIsPlaying = useAudioStore.subscribe(
      (state) => state.isPlaying,
      async (isPlaying) => {
        const audioElement = htmlAudio.getAudioElement();
        if (!audioElement) {
          return;
        }

        const isPaused = audioElement.paused;
        const shouldPlay = isPlaying && isPaused;
        const isPlayingState = !isPaused;
        const shouldPause = !isPlaying && isPlayingState;
        const needsAction = shouldPlay || shouldPause;

        if (!needsAction) {
          return;
        }

        try {
          if (shouldPlay) {
            await htmlAudio.play();
          } else {
            htmlAudio.pause();
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

        const audioElement = htmlAudio.getAudioElement();
        if (!audioElement) {
          return;
        }

        try {
          await htmlAudio.load({
            url: track.url,
            startTime: 0,
            isLiveStream: false,
          });

          const currentState = useAudioStore.getState();
          if (currentState.isPlaying) {
            await htmlAudio.play();
          }
        } catch {
          useAudioStore.getState().setError("Error loading track");
        }
      }
    );

    const unsubscribeSeek = useAudioStore.subscribe(
      (state) => state.currentTime,
      (currentTime) => {
        const audioElement = htmlAudio.getAudioElement();
        if (!audioElement) {
          return;
        }

        const timeDiff = Math.abs(audioElement.currentTime - currentTime);
        const isDifferentSeek = currentTime !== lastSeekTimeRef.current;
        if (timeDiff > 0.1 && isDifferentSeek) {
          lastSeekTimeRef.current = currentTime;
          htmlAudio.setCurrentTime(currentTime);
        }
      }
    );

    const unsubscribeVolume = useAudioStore.subscribe(
      (state) => state.volume,
      (volume) => {
        htmlAudio.setVolume({ volume });
      }
    );

    const unsubscribeMuted = useAudioStore.subscribe(
      (state) => state.isMuted,
      (isMuted) => {
        htmlAudio.setMuted(isMuted);
      }
    );

    return () => {
      abortController.abort();

      htmlAudio.removeEventListener("bufferUpdate", handleBufferUpdate);

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
    htmlAudio,
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
