/**
 * Language helpers the adapters (such as `@audio-ui/react`) share with the
 * core. Not part of the public API: they may change in any release.
 */

export type {
  AnyFunc,
  Func,
  Nullable,
  Optional,
  Procedure,
} from "./shared/lang.js";
export {
  assertType,
  EmptyProcedure,
  isDefined,
  isNotUndefined,
  isUndefined,
  panic,
} from "./shared/lang.js";
