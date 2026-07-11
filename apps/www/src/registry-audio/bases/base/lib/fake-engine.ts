import type {
  LoadEngineParams,
  PlaybackEngine,
  PlaybackEngineEventType,
  SetEngineVolumeParams,
} from "@/registry-audio/bases/base/lib/playback-engine";

/**
 * In-memory PlaybackEngine adapter — no DOM, no network. The second
 * implementer that makes the PlaybackEngine seam real rather than
 * hypothetical. Exercised by use-audio-provider.test.tsx.
 *
 * Not part of the registry surface shipped to end users (no _registry.ts
 * entry) — this is test infrastructure for this repo's own suite.
 */
export class FakeEngine implements PlaybackEngine {
  currentTime = 0;
  duration = 0;
  paused = true;
  volume = 1;
  muted = false;
  playbackRate = 1;
  src = "";

  private readonly eventTarget = new EventTarget();
  readonly calls: { method: string; args: unknown[] }[] = [];

  private record(method: string, args: unknown[]) {
    this.calls.push({ args, method });
  }

  /** Test-only: fire an engine-level event as if the device produced it. */
  emit(type: PlaybackEngineEventType, detail?: unknown): void {
    this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
  }

  init(): void {
    this.record("init", []);
  }

  async load(params: LoadEngineParams): Promise<void> {
    this.record("load", [params]);
    this.src = params.url;
    this.currentTime = params.startTime ?? 0;
  }

  async play(): Promise<void> {
    this.record("play", []);
    this.paused = false;
    this.emit("play");
  }

  pause(): void {
    this.record("pause", []);
    this.paused = true;
    this.emit("pause");
  }

  isPaused(): boolean {
    return this.paused;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  setCurrentTime(time: number): void {
    this.record("setCurrentTime", [time]);
    this.currentTime = time;
  }

  getDuration(): number {
    return this.duration;
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(params: SetEngineVolumeParams): void {
    this.record("setVolume", [params]);
    this.volume = params.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.record("setMuted", [muted]);
    this.muted = muted;
    this.emit("volumechange");
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /** Trusts its caller — see ADR-0002. */
  setPlaybackRate(rate: number): void {
    this.record("setPlaybackRate", [rate]);
    this.playbackRate = rate;
  }

  getSource(): string {
    return this.src;
  }

  getBufferedRanges(): TimeRanges | null {
    return null;
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
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(type, listener, options);
  }
}
