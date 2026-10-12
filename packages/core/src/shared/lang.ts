export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type Procedure<T> = (value: T) => void;
export type Func<U, T> = (value: U) => T;
export type AnyFunc = (...args: any[]) => any;

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const isUndefined = (value: unknown): value is undefined =>
  value === undefined;

export const isNotUndefined = <T>(value: Optional<T>): value is T =>
  value !== undefined;

// A function declaration (not an arrow) so TypeScript narrows after the call.
export function panic(issue?: string | Error | unknown): never {
  throw typeof issue === "string" ? new Error(issue) : issue;
}

export const EmptyProcedure: Procedure<unknown> = (): void => {
  // no-op
};

export function assertType<T>(_value: unknown): asserts _value is T {
  // no-op
}
