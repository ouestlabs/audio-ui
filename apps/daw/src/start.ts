import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Every response the app's Worker gives is cross-origin isolated, as the
 * prerendered page is in production through `public/_headers`: the audio
 * engine shares its recordings with its worklets in shared memory, which only
 * an isolated page may do. In development every page comes from here.
 */
const isolated = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  result.response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [isolated],
}));
