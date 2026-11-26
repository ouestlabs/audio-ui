import "@/registry/primitives/piano/web";

const MIN_PITCH = 48;
const MAX_PITCH = 72;

/** Draws the keyboard into `element`, and returns what takes it away. Its look is the piano's sheet, on its parts and attributes. */
export default function pianoWebDemo(element) {
  const keys = Array.from(
    { length: MAX_PITCH - MIN_PITCH + 1 },
    (_, index) =>
      `<audio-ui-piano-key pitch="${MIN_PITCH + index}"><button></button></audio-ui-piano-key>`
  ).join("");
  element.innerHTML = `
    <audio-ui-piano aria-label="Piano" data-size="default" min-pitch="${MIN_PITCH}" max-pitch="${MAX_PITCH}">${keys}</audio-ui-piano>`;
  return () => {
    element.innerHTML = "";
  };
}
