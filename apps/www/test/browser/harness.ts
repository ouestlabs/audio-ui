/**
 * What a `*.check.ts` file runs in the page: it names its checks with
 * `check(name, run)`, and `run.ts` asks the page for their results.
 */

export interface CheckResult {
  message?: string;
  name: string;
  ok: boolean;
}

const checks: { name: string; run: () => Promise<void> | void }[] = [];

/** A check of the page: it fails by throwing, as `assert` does. */
export function check(name: string, run: () => Promise<void> | void) {
  checks.push({ name, run });
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** The first index where two runs of samples differ, or -1 when every sample is the same. */
export function firstDifference(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>
): number {
  const length = Math.max(actual.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    if (!Object.is(actual[index], expected[index])) {
      return index;
    }
  }
  return -1;
}

declare global {
  interface Window {
    runChecks: () => Promise<CheckResult[]>;
  }
}

/** One check's result, its errors caught. */
async function runOne({
  name,
  run,
}: (typeof checks)[number]): Promise<CheckResult> {
  try {
    await run();
    return { name, ok: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : String(error),
      name,
      ok: false,
    };
  }
}

// One at a time: an audio check shares the device with the next one.
window.runChecks = () =>
  checks.reduce<Promise<CheckResult[]>>(
    async (done, next) => [...(await done), await runOne(next)],
    Promise.resolve([])
  );
