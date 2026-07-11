import type {
  LoadEngineParams,
  PlaybackEngine,
  PlaybackEngineErrorDetail,
  PlaybackEngineEventType,
  SetEngineVolumeParams,
} from "@/registry-audio/bases/base/lib/playback-engine";

type FadeVolumeParams = {
  audio: HTMLAudioElement;
  targetVolume: number;
  duration: number;
};

/** Maps a native `MediaError` code to a message and whether a retry is worth attempting. */
function getErrorInfo(errorCode: number): {
  message: string;
  recoverable: boolean;
} {
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
}

function describeAudioError(
  audio: HTMLAudioElement
): PlaybackEngineErrorDetail {
  if (audio.error) {
    const errorCode = audio.error.code;
    return { ...getErrorInfo(errorCode), errorCode };
  }
  return { errorCode: 0, message: "Unknown audio error", recoverable: false };
}

/** Native `<audio>` events forwarded verbatim onto the engine's own EventTarget. */
const FORWARDED_AUDIO_EVENTS: readonly PlaybackEngineEventType[] = [
  "play",
  "pause",
  "playing",
  "waiting",
  "loadstart",
  "canplay",
  "canplaythrough",
  "timeupdate",
  "durationchange",
  "volumechange",
  "ended",
];

class HtmlAudioEngine implements PlaybackEngine {
  private audio: HTMLAudioElement | null = null;
  private isInitialized = false;
  private playPromise: Promise<void> | null = null;
  private lastVolume = 1;
  private fadeTimeout: NodeJS.Timeout | null = null;
  private retryAttempts = 0;
  private readonly maxRetries = 3;
  private readonly eventTarget = new EventTarget();
  private readonly LOAD_TIMEOUT_LIVE = 60_000;
  private readonly LOAD_TIMEOUT_NORMAL = 30_000;
  private readonly FADE_UPDATE_INTERVAL = 16;

  /** Initialize the audio element and event listeners */
  init(): void {
    if (this.isInitialized || !this.isClient()) {
      return;
    }

    this.isInitialized = true;

    if (this.isClient()) {
      this.audio = new Audio();
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    if (!this.isClient()) {
      return;
    }

    const audio = this.ensureAudio();
    if (!audio) {
      return;
    }

    for (const type of FORWARDED_AUDIO_EVENTS) {
      audio.addEventListener(type, () => {
        this.eventTarget.dispatchEvent(new CustomEvent(type));
      });
    }

    // Safari can report duration from `loadedmetadata` before `durationchange`
    // fires — re-dispatch it under the same engine-level event so callers
    // only ever need to know about one duration-changed event.
    audio.addEventListener("loadedmetadata", () => {
      this.eventTarget.dispatchEvent(new CustomEvent("durationchange"));
    });

    audio.addEventListener("error", () => {
      // Silent error handling - errors are handled via retry logic

      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts += 1;

        setTimeout(() => {
          this.reloadAudio();
        }, 1000);
      }

      this.eventTarget.dispatchEvent(
        new CustomEvent("error", { detail: describeAudioError(audio) })
      );
    });

    audio.addEventListener("playing", () => {
      this.retryAttempts = 0;
    });

    audio.addEventListener("canplaythrough", () => {
      this.retryAttempts = 0;
    });

    audio.addEventListener("progress", () => {
      const buffered = audio.buffered;
      const currentTime = audio.currentTime;
      let bufferedEnd = 0;

      if (buffered.length === 0) {
        return;
      }

      for (let i = buffered.length - 1; i >= 0; i--) {
        if (buffered.start(i) <= currentTime) {
          bufferedEnd = buffered.end(i);
          break;
        }
      }

      if (bufferedEnd === 0) {
        bufferedEnd = buffered.end(0);
      }

      if (bufferedEnd > 0) {
        this.eventTarget.dispatchEvent(
          new CustomEvent("bufferupdate", {
            detail: { bufferedTime: bufferedEnd },
          })
        );
      }
    });
  }

  cleanup(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.load();
    }

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    this.playPromise = null;
  }

  private isClient(): boolean {
    return typeof window !== "undefined" && !!window.document;
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.isClient()) {
      throw new Error("Audio module not available on server side");
    }
    if (!this.audio) {
      throw new Error("Audio module not initialized");
    }
    return this.audio;
  }

  /**
   * Executes a function only if on client side
   */
  private ifClient<T>(fn: () => T): T | undefined {
    if (!this.isClient()) {
      return;
    }
    return fn();
  }

  async load(params: LoadEngineParams): Promise<void> {
    const { url, startTime = 0, isLiveStream = false } = params;
    const result = this.ifClient(() =>
      this._load({ isLiveStream, startTime, url })
    );
    if (result) {
      await result;
    }
  }

  private async _load(params: {
    url: string;
    startTime: number;
    isLiveStream: boolean;
  }): Promise<void> {
    const { url, startTime, isLiveStream } = params;
    const audio = this.ensureAudio();
    if (!audio) {
      return;
    }

    try {
      this.retryAttempts = 0;
      if (audio.src === url) {
        if (audio.currentTime !== startTime && !isLiveStream) {
          audio.currentTime = startTime;
        }
        return;
      }

      audio.pause();
      audio.src = "";

      audio.src = url;
      audio.preload = "auto";

      const loadTimeout = isLiveStream
        ? this.LOAD_TIMEOUT_LIVE
        : this.LOAD_TIMEOUT_NORMAL;

      await new Promise<void>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | null = null;
        let isResolved = false;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          audio.removeEventListener("loadedmetadata", handleLoadSuccess);
          audio.removeEventListener("canplay", handleLoadSuccess);
          audio.removeEventListener("canplaythrough", handleLoadSuccess);
          audio.removeEventListener("error", handleErrorLoading);
        };

        const handleTimeout = () => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          cleanup();

          reject(
            new Error(
              `Audio load timeout (${loadTimeout / 1000}s). ReadyState: ${audio.readyState}, NetworkState: ${audio.networkState}, URL: ${audio.src}`
            )
          );
        };

        const handleLoadSuccess = () => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          cleanup();

          // Don't set currentTime for live streams
          if (startTime > 0 && !isLiveStream) {
            audio.currentTime = startTime;
          }
          resolve();
        };

        const handleErrorLoading = () => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          cleanup();
          const error = audio.error;
          const errorMessage =
            error?.message || `Error code: ${error?.code ?? "unknown"}`;
          // Silent error - reject without console logging
          reject(new Error(`Audio load failed: ${errorMessage}`));
        };

        timeoutId = setTimeout(handleTimeout, loadTimeout);

        audio.addEventListener("loadedmetadata", handleLoadSuccess);
        audio.addEventListener("canplay", handleLoadSuccess);
        audio.addEventListener("canplaythrough", handleLoadSuccess);
        audio.addEventListener("error", handleErrorLoading);
        audio.load();
      });
    } catch (error) {
      console.error("Audio load process error:", error);
      throw error;
    }
  }

  async play(): Promise<void> {
    const result = this.ifClient(() => this._play());
    if (result) {
      await result;
    }
  }

  private async _play(): Promise<void> {
    if (!this.audio) {
      throw new Error("Audio module not initialized");
    }

    try {
      if (!this.audio.paused) {
        return;
      }
      this.playPromise = this.audio.play();
      await this.playPromise;
      this.playPromise = null;
    } catch (error) {
      this.playPromise = null;
      // Silent error - throw without console logging
      throw error;
    }
  }

  private reloadAudio(): void {
    if (!this.isClient()) {
      return;
    }

    const audio = this.ensureAudio();
    const currentTime = audio.currentTime;
    const wasPlaying = !audio.paused;
    const currentSrc = audio.src;

    audio.pause();
    audio.src = "";
    audio.load();
    audio.src = currentSrc;
    audio.preload = "auto";
    audio.load();

    const setTimeAndPlay = () => {
      if (audio.readyState >= audio.HAVE_METADATA) {
        audio.currentTime = currentTime;
        if (wasPlaying) {
          this.play().catch(() => {
            // Silent error handling
          });
        }
        audio.removeEventListener("loadedmetadata", setTimeAndPlay);
      }
    };

    audio.addEventListener("loadedmetadata", setTimeAndPlay);
  }

  pause(): void {
    this.ifClient(() => {
      const audio = this.ensureAudio();
      audio.pause();
    });
  }

  setVolume(params: SetEngineVolumeParams): void {
    const { volume, fadeTime = 0 } = params;
    this.ifClient(() => {
      const audio = this.ensureAudio();

      if (this.fadeTimeout) {
        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;
      }

      if (fadeTime <= 0) {
        audio.volume = Math.max(0, Math.min(1, volume));
        if (volume > 0) {
          this.lastVolume = volume;
        }
        return;
      }

      this.fadeVolume({
        audio,
        duration: fadeTime,
        targetVolume: volume,
      });
    });
  }

  private fadeVolume(params: FadeVolumeParams): void {
    const { audio, targetVolume, duration } = params;
    if (!this.isClient()) {
      return;
    }

    const startVolume = audio.volume;
    const endVolume = Math.max(0, Math.min(1, targetVolume));
    const startTime = performance.now();

    const updateVolume = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const currentVolume = startVolume + (endVolume - startVolume) * progress;

      audio.volume = currentVolume;

      if (progress < 1) {
        this.fadeTimeout = setTimeout(updateVolume, this.FADE_UPDATE_INTERVAL);
      } else {
        if (endVolume > 0) {
          this.lastVolume = endVolume;
        }
        this.fadeTimeout = null;
      }
    };

    updateVolume();
  }

  getVolume(): number {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.volume;
      }) ?? 0
    );
  }

  setMuted(muted: boolean): void {
    this.ifClient(() => {
      const audio = this.ensureAudio();
      if (audio.muted === muted) {
        return;
      }

      if (muted) {
        if (audio.volume > 0) {
          this.lastVolume = audio.volume;
        }
        this.fadeVolume({ audio, duration: 200, targetVolume: 0 });
        audio.muted = true;
      } else {
        audio.muted = false;
        this.fadeVolume({
          audio,
          duration: 200,
          targetVolume: this.lastVolume,
        });
      }
    });
  }

  isMuted(): boolean {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.muted;
      }) ?? false
    );
  }

  getDuration(): number {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.duration;
      }) ?? 0
    );
  }

  getCurrentTime(): number {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.currentTime;
      }) ?? 0
    );
  }

  setCurrentTime(time: number): void {
    this.ifClient(() => {
      const audio = this.ensureAudio();
      const duration = audio.duration;

      if (Number.isNaN(duration)) {
        return;
      }

      const isValidTime = time >= 0 && time <= duration;
      const validTime = isValidTime
        ? time
        : Math.max(0, Math.min(time, duration));

      if (audio.readyState >= audio.HAVE_METADATA) {
        audio.currentTime = validTime;
      }
    });
  }

  addEventListener(
    type: PlaybackEngineEventType,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: PlaybackEngineEventType,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean
  ): void {
    this.eventTarget.removeEventListener(type, callback, options);
  }

  getSource(): string {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.src;
      }) ?? ""
    );
  }

  isPaused(): boolean {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.paused;
      }) ?? true
    );
  }

  getBufferedRanges(): TimeRanges | null {
    if (!(this.isClient() && this.audio)) {
      return null;
    }
    return this.audio.buffered;
  }

  /** `rate` must already be clamped by the caller — see ADR-0002. */
  setPlaybackRate(rate: number): void {
    this.ifClient(() => {
      const audio = this.ensureAudio();
      audio.playbackRate = rate;
    });
  }

  getPlaybackRate(): number {
    return (
      this.ifClient(() => {
        const audio = this.ensureAudio();
        return audio.playbackRate;
      }) ?? 1
    );
  }
}

export const $htmlAudio: PlaybackEngine = new HtmlAudioEngine();

const MINUTE_IN_SECONDS = 60;

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / MINUTE_IN_SECONDS);
  const remainingSeconds = Math.floor(seconds % MINUTE_IN_SECONDS);
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}
