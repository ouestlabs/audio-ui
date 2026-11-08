declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
/** The page's one AudioContext, made the first time something asks for it. */
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

  private isClient(): boolean {
    return typeof window !== "undefined" && !!window.document;
  }
}

export const webAudio = new WebAudio();
