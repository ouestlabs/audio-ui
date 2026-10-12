export { getDataAttributes } from "./dom/attributes";
export { createFrameTask, type FrameTask } from "./dom/frame";
export { isReleased } from "./dom/pointer";
export { observeVisibility } from "./dom/visibility";
export type { Point } from "./shared/math";
export {
  clamp,
  clampFinite,
  clampUnit,
  degToRad,
  PI_HALF,
  quantizeRound,
  radToDeg,
  roundToStep,
  TAU,
} from "./shared/math";
export { isBlackKey, pitchName } from "./shared/pitch";
export {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "./value/events";
export { createPairFormatter } from "./value/format";
export {
  moveRange,
  normalizeRange,
  type RangeEdge,
  type RangeLimits,
  type RangeValue,
} from "./value/range";
export {
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
  type ParameterScale,
  type ParameterScaleProp,
  resolveScale,
} from "./value/scale";
export { createSource, type Source, type WritableSource } from "./value/source";
export { createStore, type Store } from "./value/store";
