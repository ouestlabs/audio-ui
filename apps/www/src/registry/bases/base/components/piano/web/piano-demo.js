import "@/registry/bases/base/primitives/piano/web";

const MIN_PITCH = 48;
const MAX_PITCH = 72;

/** Draws the keyboard into `element`, and returns what takes it away. */
export default function pianoWebDemo(element) {
  const keys = Array.from(
    { length: MAX_PITCH - MIN_PITCH + 1 },
    (_, index) =>
      `<audio-ui-piano-key pitch="${MIN_PITCH + index}"><button class="cn-piano-key cursor-pointer"></button></audio-ui-piano-key>`
  ).join("");
  element.innerHTML = `
    <audio-ui-piano aria-label="Piano" class="cn-piano cn-piano-size-default w-full touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50" min-pitch="${MIN_PITCH}" max-pitch="${MAX_PITCH}">${keys}</audio-ui-piano>`;
  return () => {
    element.innerHTML = "";
  };
}
