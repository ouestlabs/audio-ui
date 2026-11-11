/** What each context has loaded, by the processor's source. */
const loaded = new WeakMap<BaseAudioContext, Map<string, Promise<boolean>>>();

/**
 * Loads the source of an `AudioWorklet` processor into a context, from a blob,
 * so there is no file to serve. A source is loaded once per context: every
 * later call gets the same promise. It resolves to `true` once the processor
 * can be made, and to `false` where it cannot: a context with no worklets (a
 * page without a secure origin) or a module that failed to load. It never
 * rejects, so an engine plays without its worklet rather than throwing.
 */
export function loadWorklet(
  ctx: BaseAudioContext,
  source: string
): Promise<boolean> {
  const sources = loaded.get(ctx) ?? new Map<string, Promise<boolean>>();
  loaded.set(ctx, sources);
  const cached = sources.get(source);
  if (cached) {
    return cached;
  }
  // The DOM types give every context a worklet; a page without a secure
  // origin, or a test's stand-in context, has none.
  const worklet: AudioWorklet | undefined = ctx.audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([source], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  sources.set(source, done);
  return done;
}
