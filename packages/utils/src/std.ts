export type int = number;
export type unitValue = number; // 0...1
export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined | null;
export type ValueOrProvider<T> = T | (() => T);
export type Procedure<T> = (value: T) => void;
export type Func<U, T> = (value: U) => T;
export type AnyFunc = (...args: any[]) => any;
export type AssertType<T> = (value: unknown) => value is T;
export type Exec = () => void;

export const isDefined = <T>(value: Maybe<T>): value is T =>
  value !== undefined && value !== null;

export const isUndefined = (value: unknown): value is undefined =>
  value === undefined;

export const isNotUndefined = <T>(value: Optional<T>): value is T =>
  value !== undefined;

export const asDefined = <T>(
  value: Maybe<T>,
  fail: ValueOrProvider<string> = "asDefined failed"
): T =>
  value === null || value === undefined ? panic(getOrProvide(fail)) : value;

export const Unhandled = <R>(empty: never): R => {
  throw new Error(`Unhandled ${empty}`);
};

export const panic = (issue?: string | Error | unknown): never => {
  throw typeof issue === "string" ? new Error(issue) : issue;
};

export const getOrProvide = <T>(value: ValueOrProvider<T>): T =>
  value instanceof Function ? value() : value;

export const EmptyExec: Exec = (): void => {
  // no-op
};

export const EmptyProcedure: Procedure<any> = (_: any): void => {
  // no-op
};

export function assertType<T>(_value: unknown): asserts _value is T {
  // no-op
}
