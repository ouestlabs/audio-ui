declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
/**
 * The page's one AudioContext: the factory every hook and block that starts
 * sound gets it from, so a page never makes two. Framework-free code (an
 * engine, a lib) takes the context as a parameter instead, so it also runs on
 * an `OfflineAudioContext`; a hook given a node uses that node's context.
 */
export class WebAudio {
  #audioContext: AudioContext | null = null;
  #options: AudioContextOptions = {};

  /** The options the context is made with, such as its `latencyHint`: call it before anything asks for the context, as they do not change one already made. */
  configure(options: AudioContextOptions) {
    this.#options = options;
  }

  getContext(): AudioContext | null {
    if (!this.isClient()) {
      return null;
    }

    if (!this.#audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      this.#audioContext = new AudioContextClass(this.#options);
    }

    const ctx = this.#audioContext;

    return ctx;
  }

  /**
   * The page's context, resumed unless it already runs: call it in the gesture
   * that starts sound (a click, a key, a MIDI note), the moment browsers let a
   * context start. `null` on the server.
   */
  resume(): AudioContext | null {
    const ctx = this.getContext();
    if (ctx && ctx.state !== "running" && ctx.state !== "closed") {
      ctx.resume();
    }
    return ctx;
  }

  private isClient(): boolean {
    return typeof window !== "undefined" && !!window.document;
  }
}

export const webAudio = new WebAudio();
