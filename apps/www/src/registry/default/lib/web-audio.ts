declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
export class WebAudio {
  #audioContext: AudioContext | null = null;
  #isInitialized = false;

  init(): void {
    if (this.#isInitialized || !this.isClient()) {
      return;
    }

    this.#isInitialized = true;

    if (this.isClient()) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.#audioContext = new AudioContextClass();
      }
    }
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
    this.#isInitialized = false;
  }

  private isClient(): boolean {
    return typeof window !== "undefined" && !!window.document;
  }
}

export const $webAudio = new WebAudio();
