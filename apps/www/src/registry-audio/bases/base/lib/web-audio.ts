declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
/** The page's one AudioContext, made the first time something asks for it. */
export class WebAudio {
  #audioContext: AudioContext | null = null;

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
      this.#audioContext = new AudioContextClass();
    }

    const ctx = this.#audioContext;

    return ctx;
  }

  cleanup(): void {
    if (this.#audioContext) {
      this.#audioContext.close();
      this.#audioContext = null;
    }
  }

  private isClient(): boolean {
    return typeof window !== "undefined" && !!window.document;
  }
}

export const webAudio = new WebAudio();
